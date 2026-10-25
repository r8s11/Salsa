const encoder = new TextEncoder();

function encode(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

export async function signLocalJwt(claims, secret) {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode(claims);
  const content = `${header}.${payload}`;
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(content));
  return `${content}.${Buffer.from(signature).toString("base64url")}`;
}

export async function verifyLocalJwt(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    if (parsedHeader.alg !== "HS256") return null;
    const key = await importHmacKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(signature, "base64url"),
      encoder.encode(`${header}.${payload}`)
    );
    if (!valid) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (claims.role !== "anon" && claims.role !== "authenticated") return null;
    if (
      claims.role === "authenticated" &&
      (typeof claims.sub !== "string" || claims.sub.trim().length === 0)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
