import { isFirefox } from './platform.mjs';
const $ = id => document.getElementById(id);
function setupCapture() {
  const captureButton = $('capture-window');
  if (!captureButton) {
    const status = $('status');
    if (status) {
      status.textContent = 'The launcher needs to be refreshed. Reload the extension, then close and reopen the launcher.';
      status.classList.add('error');
    }
    return;
  }
  captureButton.addEventListener('click', async () => {
  try {
    // Must remain directly inside the click gesture for the optional permission request.
    // Firefox closes the popup when its permission prompt appears, so the manager asks there instead.
    if (!isFirefox && !await chrome.permissions.request({ permissions: ['tabs'] })) throw new Error('Tab access was declined. You can still create a workspace from bookmarks.');
    const current = await chrome.windows.getCurrent();
    if (current.incognito) throw new Error('Choose a regular, non-private browser window.');
    await chrome.tabs.create({ url: chrome.runtime.getURL(`manager.html?captureWindow=${current.id}#workspaces`) });
    window.close();
  } catch (error) {
    $('status').textContent = error.message;
    $('status').classList.toggle('error', true);
  }
});

}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupCapture, { once: true });
} else {
  setupCapture();
}
