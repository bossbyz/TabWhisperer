import { flatten, safeUrl, baseTitle, bookmarkTitle, parseAliases, nicknameSuffix } from './core.mjs';
import { setupShortcuts } from './shortcuts.js';
import './workspace-manager.js';
import { resolveWorkspace } from './workspaces.mjs';
import { monogram } from './monogram.mjs';
const $ = id => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(name, focus = false) {
  if (!['workspaces', 'bookmarks', 'settings'].includes(name)) name = 'workspaces';
  for (const tab of tabs) {
    const selected = tab.id === `tab-${name}`;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !selected;
    if (selected && focus) tab.focus();
  }
  try { localStorage.setItem('manager-tab', name); } catch {}
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab.id.slice(4)));
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); selectTab(tabs[next].id.slice(4), true);
  });
}
function initialTab() {
  if (location.search.includes('captureWindow=') || location.hash === '#workspaces') return 'workspaces';
  if (location.hash) return location.hash.slice(1);
  try { return localStorage.getItem('manager-tab') || 'workspaces'; } catch { return 'workspaces'; }
}
selectTab(initialTab());
window.addEventListener('hashchange', () => selectTab(initialTab()));
window.addEventListener('show-workspaces', () => selectTab('workspaces'));
let bookmarks = [], aliases = {}, managedSuffixes = {}, shown = 60;
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
async function refresh() {
  const [tree, saved] = await Promise.all([chrome.bookmarks.getTree(), chrome.storage.local.get(['aliases', 'managedSuffixes'])]);
  bookmarks = flatten(tree).filter(b => safeUrl(b.url));
  aliases = saved.aliases || {};
  managedSuffixes = saved.managedSuffixes || {};
  render();
}
function render() {
  const query = $('search').value.trim().toLowerCase();
  const matches = bookmarks.filter(b => (!$('named').checked || aliases[b.id]?.length)
    && `${b.title} ${b.url} ${b.folder} ${(aliases[b.id] || []).join(' ')}`.toLowerCase().includes(query));
  matches.sort((a, b) => Number(Boolean(aliases[b.id]?.length)) - Number(Boolean(aliases[a.id]?.length)) || a.title.localeCompare(b.title));
  $('count').textContent = `${matches.length} bookmarks · ${bookmarks.filter(b => aliases[b.id]?.length).length} nicknamed`;
  $('list').replaceChildren();
  if (!matches.length) { const empty = document.createElement('p'); empty.textContent = 'No bookmarks found. Try another search or add a bookmark in your browser.'; $('list').append(empty); }
  for (const bookmark of matches.slice(0, shown)) {
    const row = $('row').content.cloneNode(true);
    row.querySelector('h2').textContent = bookmark.title;
    row.querySelector('.address').textContent = bookmark.url;
    row.querySelector('.folder').textContent = bookmark.folder;
    const summary = row.querySelector('summary');
    monogram(summary, bookmark.title);
    summary.toggleAttribute('data-named', Boolean(aliases[bookmark.id]?.length));
    const title = row.querySelector('.title-input');
    const previousSuffix = managedSuffixes[bookmark.id] || nicknameSuffix(aliases[bookmark.id]);
    title.value = baseTitle(bookmark.title, previousSuffix);
    title.setAttribute('aria-label', `Title for ${bookmark.title}`);
    const input = row.querySelector('.aliases-input');
    input.value = (aliases[bookmark.id] || []).join(', ');
    input.setAttribute('aria-label', `Nicknames for ${bookmark.title}`);
    const preview = row.querySelector('.title-preview');
    const updatePreview = () => {
      try { preview.textContent = `Saved title: ${bookmarkTitle(baseTitle(title.value, previousSuffix), parseAliases(input.value))}`; }
      catch (error) { preview.textContent = error.message; }
    };
    title.addEventListener('input', updatePreview);
    input.addEventListener('input', updatePreview);
    updatePreview();
    const button = row.querySelector('button');
    row.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); button.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({ type: 'save', id: bookmark.id, title: title.value, value: input.value });
        if (!response?.ok) throw new Error(response?.error || 'Could not save.');
        status('Bookmark title and nicknames saved.');
        await refresh();
      } catch (error) { status(error.message, true); button.disabled = false; }
    });
    $('list').append(row);
  }
  $('more').hidden = matches.length <= shown;
}
$('search').addEventListener('input', () => { shown = 60; render(); });
$('named').addEventListener('change', () => { shown = 60; render(); });
$('more').addEventListener('click', () => { shown += 60; render(); });
$('export').addEventListener('click', async () => {
  try {
    // Read fresh data so another manager window's changes are included.
    const [tree, saved] = await Promise.all([chrome.bookmarks.getTree(), chrome.storage.local.get(['aliases', 'workspaces'])]);
    const map = saved.aliases || {};
    const entries = flatten(tree).filter(b => map[b.id]?.length).map(b => ({ id: b.id, url: b.url, aliases: map[b.id] }));
    const workspaces = (saved.workspaces || []).map(w => resolveWorkspace(w, flatten(tree)));
    const data = JSON.stringify({ format: 'bookmark-nicknames', version: 1, entries, workspaces }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'bookmark-nicknames-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status('Backup downloaded with nicknames and workspaces. It contains private addresses; keep it private.');
  } catch (error) { status(error.message, true); }
});
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => {
  try {
    const file = $('file').files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose a backup smaller than 5 MB.');
    const data = JSON.parse(await file.text());
    const response = await chrome.runtime.sendMessage({ type: 'import', data });
    if (!response?.ok) throw new Error(response?.error || 'Could not restore.');
    await refresh(); window.dispatchEvent(new Event('workspaces-refresh')); status(`Restored ${response.matched} bookmark entries and ${response.workspaceCount || 0} workspaces. Bookmark entries without an existing bookmark were skipped.`);
  } catch (error) { status(error.message, true); }
  finally { $('file').value = ''; }
});
refresh().catch(error => status(`Could not read bookmarks: ${error.message}`, true));
setupShortcuts();
