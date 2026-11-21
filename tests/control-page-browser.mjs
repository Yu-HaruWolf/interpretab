// No API key or live translation: exercise real Chrome tab routing and settings.
import assert from "node:assert/strict";
import path from "node:path";
import { Chrome } from "./chrome-harness.mjs";

const browser = await Chrome.launch();
try {
  const id = await browser.loadExtension(path.resolve("."));
  const options = await browser.newPage(`chrome-extension://${id}/options.html`);
  await options.waitFor(`document.getElementById('apiKey') !== null`);
  const sourceId = await options.eval(`(async () => {
    await chrome.storage.local.set({ configUpdates: false });
    const source = await chrome.tabs.create({url: 'https://example.com'});
    const {openControlPage} = await import('./lib/control-page.js');
    await openControlPage(source.id);
    return source.id;
  })()`);
  const fragment = `sidepanel.html?tabId=${sourceId}`;
  const target = await browser.waitForTarget(fragment);
  assert.ok(target);
  const page = await browser.attach(target, { width: 1280, height: 900 });
  await page.waitFor(`document.getElementById('tabTarget').options.length > 0`);
  await options.eval(`(async () => {
    const {openControlPage} = await import('./lib/control-page.js');
    await openControlPage(${sourceId});
  })()`);
  assert.equal((await browser.targetsMatching(fragment)).length, 1);
  assert.equal(await page.eval(`document.body.scrollWidth <= innerWidth`), true);
  await page.eval(`document.getElementById('tabEnabled').click()`);
  assert.equal(await page.eval(`chrome.storage.local.get('tabEnabled').then(s => s.tabEnabled)`), false);
  await page.screenshot('/tmp/interpretab-control-page.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.eval(`document.body.scrollWidth <= innerWidth`), true);
  await browser.closeTargets(fragment);
  await options.eval(`(async () => {
    const {openControlPage} = await import('./lib/control-page.js');
    await openControlPage(${sourceId});
  })()`);
  assert.ok(await browser.waitForTarget(fragment));
  console.log('PASS: standalone page, source binding, reuse, reopen, settings, desktop/mobile widths');
} finally {
  await browser.close();
}
