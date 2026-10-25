// Chromium does not expose a command-rebinding API. Guide users to its built-in editor.
export function setupShortcuts() {
  const $ = id => document.getElementById(id);
  $('shortcuts').addEventListener('click', () => {
    const panel = $('shortcut-help');
    panel.hidden = !panel.hidden;
    $('shortcuts').setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) $('shortcut-settings').focus();
  });
  $('shortcut-settings').addEventListener('click', async () => {
    await chrome.tabs.create({ url: 'edge://extensions/shortcuts' });
  });
  return chrome.commands.getAll().then(commands => {
    const shortcut = commands.find(command => command.name === '_execute_action')?.shortcut;
    $('shortcut').textContent = shortcut || 'Not assigned — set your shortcut below';
  }).catch(() => { $('shortcut').textContent = 'View your shortcut in Edge settings'; });
}
