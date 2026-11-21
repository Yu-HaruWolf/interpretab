/** Open or focus the controls belonging to the page whose icon was clicked. */
export async function openControlPage(sourceTabId) {
  const key = `controlPage:${sourceTabId}`;
  const url = chrome.runtime.getURL(`sidepanel.html?tabId=${sourceTabId}`);
  const saved = (await chrome.storage.session.get(key))[key];
  if (saved != null) {
    try {
      const existing = await chrome.tabs.get(saved);
      if (existing.url === url) {
        await chrome.tabs.update(saved, { active: true });
        await chrome.windows.update(existing.windowId, { focused: true });
        return;
      }
    } catch {
      // Closed or moved since the last click; create a fresh control page.
    }
  }
  const page = await chrome.tabs.create({ url });
  await chrome.storage.session.set({ [key]: page.id });
}
