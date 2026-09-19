import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { verifyLocalJwt } from "./jwt.mjs";

const OBJECT_PREFIX = "/storage/v1/object/";
const PUBLIC_PREFIX = `${OBJECT_PREFIX}public/`;
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKETS = new Set(["event-flyers", "profile-media"]);
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(status, value) {
  return Response.json(value, { status });
}

function failure(status, message) {
  return json(status, { statusCode: String(status), error: message, message });
}

function parseObjectPath(pathname, prefix) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return null;
  }
  const [bucket, ...segments] = decoded.split("/");
  if (!BUCKETS.has(bucket) || segments.length < 2) return null;
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return { bucket, path: segments.join("/"), segments };
}

async function claimsFrom(request, secret) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return verifyLocalJwt(match?.[1], secret);
}

function mayWrite({ bucket, segments }, claims) {
  if (!claims) return false;
  if (bucket === "event-flyers" && segments[0] === "anonymous") {
    return claims.role === "anon";
  }
  return claims.role === "authenticated" && claims.sub === segments[0];
}

function diskPath(root, { bucket, segments }) {
  const bucketRoot = resolve(root, bucket);
  const target = resolve(bucketRoot, ...segments);
  return target.startsWith(`${bucketRoot}${sep}`) ? target : null;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readMultipartFile(request, contentType) {
  const boundary = contentType.match(/boundary=(?:\"([^\"]+)\"|([^;]+))/i)?.slice(1).find(Boolean);
  if (!boundary) return null;
  const body = Buffer.from(await request.arrayBuffer());
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = 0;
  while ((cursor = body.indexOf(delimiter, cursor)) !== -1) {
    cursor += delimiter.length;
    if (body.subarray(cursor, cursor + 2).toString() === "--") break;
    if (body.subarray(cursor, cursor + 2).toString() === "\r\n") cursor += 2;
    const headerEnd = body.indexOf("\r\n\r\n", cursor);
    if (headerEnd === -1) return null;
    const headers = body.subarray(cursor, headerEnd).toString("utf8");
    const nextBoundary = body.indexOf(Buffer.from(`\r\n--${boundary}`), headerEnd + 4);
    if (nextBoundary === -1) return null;
    if (/content-disposition:[^\r\n]*filename=/i.test(headers)) {
      const fileType = headers.match(/content-type:\s*([^\r\n;]+)/i)?.[1]?.toLowerCase();
      return {
        contentType: fileType ?? "application/octet-stream",
        bytes: new Uint8Array(body.subarray(headerEnd + 4, nextBoundary)),
      };
    }
    cursor = nextBoundary + 2;
  }
  return null;
}


export async function startStorageServer({ root, jwtSecret, port = 0 }) {
  if (!root || !jwtSecret) throw new Error("root and jwtSecret are required");
  const contentTypes = new Map();

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    async fetch(request) {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "authorization, apikey, content-type, x-upsert",
            "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          },
        });
      }

      if (request.method === "GET" && url.pathname.startsWith(PUBLIC_PREFIX)) {
        const object = parseObjectPath(url.pathname, PUBLIC_PREFIX);
        if (!object) return failure(400, "Invalid object path");
        const target = diskPath(root, object);
        if (!target || !(await exists(target))) return failure(404, "Object not found");
        return new Response(await readFile(target), {
          status: 200,
          headers: { "content-type": contentTypes.get(`${object.bucket}/${object.path}`) ?? "application/octet-stream" },
        });
      }

      if (request.method === "POST" && url.pathname.startsWith(OBJECT_PREFIX)) {
        const object = parseObjectPath(url.pathname, OBJECT_PREFIX);
        if (!object) return failure(400, "Invalid object path");
        const claims = await claimsFrom(request, jwtSecret);
        if (!mayWrite(object, claims)) return failure(403, "Access denied");
        const requestContentType = request.headers.get("content-type") ?? "";
        let contentType;
        let bytes;
        if (requestContentType.toLowerCase().startsWith("multipart/form-data")) {
          const file = await readMultipartFile(request, requestContentType);
          if (!file) return failure(400, "Missing file");
          ({ contentType, bytes } = file);
        } else {
          contentType = requestContentType.split(";", 1)[0].toLowerCase();
          const announced = Number(request.headers.get("content-length"));
          if (Number.isFinite(announced) && announced > MAX_BYTES) {
            return failure(413, "Object too large");
          }
          bytes = new Uint8Array(await request.arrayBuffer());
        }
        if (!MIME_TYPES.has(contentType)) return failure(400, "Unsupported content type");
        if (bytes.byteLength > MAX_BYTES) return failure(413, "Object too large");
        const target = diskPath(root, object);
        if (!target) return failure(400, "Invalid object path");
        if ((await exists(target)) && request.headers.get("x-upsert") !== "true") {
          return failure(400, "Asset already exists");
        }
        await mkdir(resolve(target, ".."), { recursive: true });
        await writeFile(target, bytes);
        contentTypes.set(`${object.bucket}/${object.path}`, contentType);
        return json(200, { Key: `${object.bucket}/${object.path}` });
      }

      if (request.method === "DELETE" && url.pathname.startsWith(OBJECT_PREFIX)) {
        const bucket = decodeURIComponent(url.pathname.slice(OBJECT_PREFIX.length));
        if (!BUCKETS.has(bucket) || bucket.includes("/")) return failure(400, "Invalid bucket");
        let body;
        try {
          body = await request.json();
        } catch {
          return failure(400, "Invalid request");
        }
        if (!Array.isArray(body?.prefixes) || body.prefixes.length === 0) {
          return failure(400, "Invalid request");
        }
        const claims = await claimsFrom(request, jwtSecret);
        const objects = body.prefixes.map((path) =>
          typeof path === "string"
            ? parseObjectPath(`${OBJECT_PREFIX}${bucket}/${path}`, OBJECT_PREFIX)
            : null
        );
        if (objects.some((object) => !object || !mayWrite(object, claims))) {
          return failure(403, "Access denied");
        }
        for (const object of objects) {
          const target = diskPath(root, object);
          if (target) await rm(target, { force: true });
          contentTypes.delete(`${object.bucket}/${object.path}`);
        }
        return json(200, []);
      }

      return failure(404, "Not found");
    },
  });

  return {
    url: `http://${server.hostname}:${server.port}`,
    close: () => server.stop(true),
  };
}
