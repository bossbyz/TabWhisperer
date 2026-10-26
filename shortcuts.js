import { browserName, shortcutSettingsUrl, shortcutSettingsSteps } from './platform.mjs';

// Chromium does not expose a command-rebinding API. Guide users to the browser's built-in editor.
export function setupShortcuts() {
  const $ = id => document.getElementById(id);
  for (const element of document.querySelectorAll('.browser-name')) element.textContent = browserName;
  $('shortcuts').addEventListener('click', () => {
    const panel = $('shortcut-help');
    panel.hidden = !panel.hidden;
    $('shortcuts').setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) $('shortcut-settings').focus();
  });
  $('shortcut-settings').addEventListener('click', async () => {
    try {
      // Firefox can open its shortcut editor directly, but blocks extensions from opening about: pages.
      if (chrome.commands.openShortcutSettings) await chrome.commands.openShortcutSettings();
      else if (shortcutSettingsUrl) await chrome.tabs.create({ url: shortcutSettingsUrl });
      else throw new Error();
    } catch { $('shortcut').textContent = shortcutSettingsSteps; }
  });
  return chrome.commands.getAll().then(commands => {
    const shortcut = commands.find(command => command.name === '_execute_action')?.shortcut;
    $('shortcut').textContent = shortcut || 'Not assigned — set your shortcut below';
  }).catch(() => { $('shortcut').textContent = `View your shortcut in ${browserName} settings`; });
}
