import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { createObsServer } from "../obs/server.mjs";
import { ObsCaptions } from "../lib/obs-captions.js";

test("OBS forwarding is opt-in, translation-only, ordered and clears on disable", async () => {
  const batches = [];
  let release;
  const bridge = new ObsCaptions(async (batch) => {
    batches.push(batch);
    if (batches.length === 1) await new Promise((resolve) => { release = resolve; });
  });
  const output = (text) => ({ type: "transcript", side: "output", direction: "tab", text, apiKey: "secret" });
  bridge.post(output("disabled"));
  assert.equal(batches.length, 0);
  bridge.configure(true);
  bridge.post({ ...output("input"), side: "input" });
  bridge.post({ type: "audio", buffer: "private" });
  bridge.post(output("first"));
  bridge.post(output("obsolete"));
  bridge.post(output("latest"));
  assert.equal(batches.length, 1);
  release();
  await new Promise(setImmediate);
  assert.deepEqual(batches, [
    [{ type: "caption", direction: "tab", text: "first" }],
    [{ type: "caption", direction: "tab", text: "latest" }],
  ]);
  bridge.configure(false);
  await new Promise(setImmediate);
  assert.deepEqual(batches.at(-1), [{ type: "clear" }]);
});

test("relay serves transparent overlay, streams snapshots, rejects web writers and invalid input", async (t) => {
  const server = createObsServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.close(); server.closeAllConnections(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (events, headers = {}) => fetch(`${base}/captions`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Interpretab": "captions", ...headers },
    body: JSON.stringify(events),
  });
  assert.equal((await fetch(base)).status, 200);
  assert.match(await (await fetch(`${base}/overlay.css`)).text(), /background: transparent !important/);
  assert.equal((await fetch(`${base}/../manifest.json`)).status, 404);
  assert.equal((await post([], { Origin: "https://untrusted.example" })).status, 403);
  const wrongHost = await new Promise((resolve, reject) => {
    const req = http.get(base, { headers: { Host: "untrusted.example" } }, (res) => {
      res.resume(); resolve(res.statusCode);
    });
    req.on("error", reject);
  });
  assert.equal(wrongHost, 403);
  assert.equal((await post([{ type: "caption", direction: "invalid", text: "x" }])).status, 400);
  assert.equal((await post([{ type: "caption", direction: "tab", text: "x".repeat(20001) }])).status, 400);
  assert.equal((await post([{ type: "caption", direction: "tab", text: "翻訳字幕" }], {
    Origin: `chrome-extension://${"a".repeat(32)}`,
  })).status, 204);
  const stream = await fetch(`${base}/events`);
  const reader = stream.body.getReader();
  const read = async () => new TextDecoder().decode((await reader.read()).value);
  const first = await read();
  assert.match(first, /翻訳字幕/);
  assert.match(first, /updatedAt/);
  await post([{ type: "clear" }]);
  assert.equal(await read(), "data: {}\n\n");
  await reader.cancel();
});
