import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { signLocalJwt } from "./jwt.mjs";
import { startStorageServer } from "./server.mjs";

const secret = "local-storage-acceptance-secret-at-least-32-bytes";
const root = await mkdtemp(join(tmpdir(), "salsa-storage-"));
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const passed = [];

function client(url, token) {
  return createClient(url, token, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function check(name, run) {
  await run();
  passed.push(name);
}

let server;
try {
  server = await startStorageServer({ root, jwtSecret: secret, port: 0 });
  const now = Math.floor(Date.now() / 1000);
  const anonToken = await signLocalJwt({ role: "anon", exp: now + 300 }, secret);
  const ownerToken = await signLocalJwt(
    { role: "authenticated", sub: ownerId, exp: now + 300 },
    secret
  );
  const otherToken = await signLocalJwt(
    { role: "authenticated", sub: otherId, exp: now + 300 },
    secret
  );
  const anon = client(server.url, anonToken);
  const owner = client(server.url, ownerToken);
  const other = client(server.url, otherToken);
  const png = new File([new Uint8Array([137, 80, 78, 71])], "flyer.png", {
    type: "image/png",
  });

  await check("anonymous flyer upload and public read", async () => {
    const path = "anonymous/submission-abc/flyer.png";
    const { error } = await anon.storage
      .from("event-flyers")
      .upload(path, png, { contentType: png.type });
    assert.equal(error, null);
    const publicUrl = anon.storage.from("event-flyers").getPublicUrl(path).data.publicUrl;
    const response = await fetch(publicUrl);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([137, 80, 78, 71]));
  });

  await check("anonymous profile upload denied", async () => {
    const { error } = await anon.storage
      .from("profile-media")
      .upload("anonymous/avatar.webp", png, { contentType: png.type });
    assert.ok(error);
    assert.equal(Number(error.statusCode), 403);
  });

  await check("authenticated owner profile upload", async () => {
    const { error } = await owner.storage
      .from("profile-media")
      .upload(`${ownerId}/avatar.webp`, png, { contentType: png.type });
    assert.equal(error, null);
    assert.deepEqual(
      new Uint8Array(await readFile(join(root, "profile-media", ownerId, "avatar.webp"))),
      new Uint8Array([137, 80, 78, 71])
    );
  });

  await check("cross-owner upload and delete denied", async () => {
    const upload = await other.storage
      .from("profile-media")
      .upload(`${ownerId}/cover.webp`, png, { contentType: png.type });
    assert.equal(Number(upload.error?.statusCode), 403);
    const remove = await other.storage.from("profile-media").remove([`${ownerId}/avatar.webp`]);
    assert.equal(Number(remove.error?.statusCode), 403);
  });

  await check("invalid MIME denied", async () => {
    const file = new File(["not-image"], "notes.txt", { type: "text/plain" });
    const { error } = await anon.storage
      .from("event-flyers")
      .upload("anonymous/submission-def/notes.txt", file, { contentType: file.type });
    assert.equal(Number(error?.statusCode), 400);
  });

  await check("oversized image denied", async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    });
    const { error } = await anon.storage
      .from("event-flyers")
      .upload("anonymous/submission-ghi/large.png", file, { contentType: file.type });
    assert.equal(Number(error?.statusCode), 413);
  });

  await check("owners clean up their objects", async () => {
    const ownerRemove = await owner.storage.from("profile-media").remove([`${ownerId}/avatar.webp`]);
    assert.equal(ownerRemove.error, null);
    const anonRemove = await anon.storage
      .from("event-flyers")
      .remove(["anonymous/submission-abc/flyer.png"]);
    assert.equal(anonRemove.error, null);
  });

  console.log(`${passed.length}/${passed.length} no-Docker Storage checks passed`);
} finally {
  server?.close();
  await rm(root, { recursive: true, force: true });
}
