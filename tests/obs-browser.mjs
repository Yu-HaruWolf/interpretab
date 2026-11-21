// Synthetic subtitles, no Gemini key or API usage. Run: node tests/obs-browser.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import { Chrome } from "./chrome-harness.mjs";
import { createObsServer } from "../obs/server.mjs";

const server = createObsServer();
server.listen(8765, "127.0.0.1");
await once(server, "listening");
let chrome;
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "interpretab-obs-test-"));
const deadline = setTimeout(() => { console.error("OBS browser test timed out"); process.exit(1); }, 45000);
try {
  const root = path.resolve(import.meta.dirname, "..");
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["tests", "docs", "store", "obs", "node_modules"].includes(entry.name)) continue;
    await fs.cp(path.join(root, entry.name), path.join(fixture, entry.name), { recursive: true });
  }
  // Native permission prompts cannot be accepted by CDP. Grant the optional
  // loopback host in this disposable fixture only; the shipped manifest remains opt-in.
  const manifest = JSON.parse(await fs.readFile(path.join(fixture, "manifest.json"), "utf8"));
  manifest.host_permissions.push(...manifest.optional_host_permissions);
  delete manifest.optional_host_permissions;
  await fs.writeFile(path.join(fixture, "manifest.json"), JSON.stringify(manifest));
  chrome = await Chrome.launch();
  const id = await chrome.loadExtension(fixture);
  const options = await chrome.newPage(`chrome-extension://${id}/options.html`);
  assert.equal(await options.waitFor(`document.getElementById("obsEnabled") !== null`), true);
  assert.equal(await options.eval(`chrome.permissions.contains({origins: ["http://127.0.0.1/*"]})`), true);
  const overlay = await chrome.newPage("http://127.0.0.1:8765/?direction=both&hold=1", {
    width: 1920, height: 1080,
  });
  assert.equal(await overlay.eval(`getComputedStyle(document.body).backgroundColor`), "rgba(0, 0, 0, 0)");
  assert.equal(await overlay.eval(`getComputedStyle(document.documentElement).backgroundColor`), "rgba(0, 0, 0, 0)");
  const sent = await options.eval(`(async () => {
    const {ObsCaptions} = await import('./lib/obs-captions.js');
    window.bridge = new ObsCaptions();
    window.bridge.configure(true);
    window.bridge.post({type: 'transcript', side: 'output', direction: 'tab', text: 'これはOBS用の翻訳字幕です。'});
    window.bridge.post({type: 'transcript', side: 'output', direction: 'mic', text: '<b>マイクの翻訳字幕</b>'});
    return true;
  })()`);
  assert.equal(sent, true);
  assert.equal(await overlay.waitFor(`document.getElementById('mic').textContent.includes('<b>')`), true);
  assert.equal(await overlay.eval(`document.querySelectorAll('#captions b').length`), 0);
  assert.equal(await overlay.eval(`document.querySelectorAll('audio,video,button,input').length`), 0);
  await chrome.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }, overlay.sessionId);
  await overlay.screenshot("/tmp/interpretab-obs-overlay.png");
  assert.equal(await overlay.waitFor(`document.getElementById('mic').textContent === ''`), true);
  await options.eval(`window.bridge.post({type: 'transcript', side: 'output', direction: 'tab', text: '停止テスト'})`);
  assert.equal(await overlay.waitFor(`document.getElementById('tab').textContent === '停止テスト'`), true);
  await options.eval(`window.bridge.configure(false)`);
  assert.equal(await overlay.waitFor(`document.getElementById('tab').textContent === ''`), true);
  console.log("OBS browser checks passed: extension relay, transparency, safe text, expiry, stop (pre-granted test permission).");
} finally {
  clearTimeout(deadline);
  await chrome?.close();
  server.close();
  server.closeAllConnections();
  await fs.rm(fixture, { recursive: true, force: true });
}
