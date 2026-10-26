import { flatten, rank, safeUrl, baseTitle, nicknameSuffix } from './core.mjs';
import { setupShortcuts } from './shortcuts.js';
import { rankWorkspaces } from './workspaces.mjs';
import { sendWorkspaceMessage } from './workspace-client.mjs';
import { monogram } from './monogram.mjs';
const $ = id => document.getElementById(id);
const input = $('query');
let bookmarks = [], aliases = {}, managedSuffixes = {}, matches = [], selected = 0, opening = false;
let currentPage;
let workspaces = [];

async function refresh() {
  const [tree, saved] = await Promise.all([chrome.bookmarks.getTree(), chrome.storage.local.get(['aliases', 'managedSuffixes', 'workspaces'])]);
  bookmarks = flatten(tree); aliases = saved.aliases || {};
  managedSuffixes = saved.managedSuffixes || {};
  workspaces = saved.workspaces || [];
  render();
}

function status(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
function select(index) {
  selected = index;
  [...$('results').children].forEach((row, i) => row.setAttribute('aria-selected', String(i === selected)));
  if (matches.length) {
    input.setAttribute('aria-activedescendant', `match-${selected}`);
    $('results').children[selected]?.scrollIntoView({ block: 'nearest' });
  } else input.removeAttribute('aria-activedescendant');
}
function render() {
  matches = [...rankWorkspaces(workspaces, input.value), ...rank(bookmarks, aliases, input.value, 8)]
    .sort((a, b) => b.score - a.score).slice(0, 8);
  $('results').replaceChildren();
  input.setAttribute('aria-expanded', String(matches.length > 0));
  matches.forEach((bookmark, index) => {
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'result'; row.id = `match-${index}`;
    row.setAttribute('role', 'option'); row.tabIndex = -1;
    row.dataset.kind = bookmark.kind || 'bookmark';
    row.toggleAttribute('data-unnamed', bookmark.kind === 'workspace' && !bookmark.nickname);
    monogram(row, bookmark.kind === 'workspace' ? bookmark.name : bookmark.title);
    const parts = bookmark.kind === 'workspace'
      ? [['strong', bookmark.nickname || bookmark.name, ''], ['span', bookmark.name, 'title'], ['span', `Workspace · ${bookmark.entries.length} tabs · Enter to open / focus · Ctrl+Enter for fresh window`, 'url']]
      : [['strong', bookmark.aliases.join(', '), ''], ['span', bookmark.title, 'title'], ['span', bookmark.url, 'url']];
    for (const [tag, text, className] of parts) {
      const part = document.createElement(tag); part.textContent = text; part.className = className; row.append(part);
    }
    row.addEventListener('click', event => { select(index); openSelected(event.ctrlKey || event.metaKey); });
    $('results').append(row);
  });
  select(0);
  const hasNicknames = rank(bookmarks, aliases, '', 1).length > 0;
  const query = input.value.trim();
  status(matches.length ? `${matches.length} matches` : currentPage && query
    ? `No matches. Press Enter to bookmark this page as “${query}”.`
    : hasNicknames ? 'No matching nicknames. Try another name.'
    : 'No nicknames yet. Type a nickname to add this page, or choose Manage nicknames.');
}

function showBookmarkForm(fromSearch = false) {
  if (!currentPage) {
    status('Open a web page to add a bookmark, then reopen the launcher.', true);
    return;
  }
  if (fromSearch || !$('page-nickname').value) $('page-nickname').value = input.value.trim();
  $('search-view').hidden = true;
  $('bookmark-page').hidden = true;
  $('page-hint').hidden = true;
  $('bookmark-form').hidden = false;
  $('bookmark-page').setAttribute('aria-expanded', 'true');
  $('launcher-title').textContent = 'Bookmark this page';
  $('page-nickname').focus();
}
async function openSelected(newTab = false) {
  if (opening || !matches[selected]) return;
  opening = true;
  try {
    const match = matches[selected];
    if (match.kind === 'workspace') {
      await sendWorkspaceMessage(chrome, { type: 'workspaceOpen', id: match.id, fresh: newTab });
    } else if (newTab) await chrome.tabs.create({ url: match.url, active: true });
    else await chrome.tabs.update({ url: match.url });
    window.close();
  } catch (error) { status(`Could not open: ${error.message}`, true); }
  finally { opening = false; }
}
input.addEventListener('input', render);
input.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (matches.length) select((selected + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (matches.length) openSelected(event.ctrlKey || event.metaKey);
    else if (input.value.trim()) showBookmarkForm(true);
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.close(); });
$('manage').addEventListener('click', async () => { await chrome.runtime.openOptionsPage(); window.close(); });
$('bookmark-page').addEventListener('click', () => showBookmarkForm());
$('back-search').addEventListener('click', () => {
  $('bookmark-form').hidden = true;
  $('search-view').hidden = false;
  $('bookmark-page').hidden = false;
  $('page-hint').hidden = false;
  $('bookmark-page').setAttribute('aria-expanded', 'false');
  $('launcher-title').textContent = 'Where to?';
  input.focus();
});
$('bookmark-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentPage || $('save-page').disabled) return;
  $('save-page').disabled = true;
  $('save-status').classList.toggle('error', false);
  $('save-status').textContent = 'Saving…';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'savePage', tabId: currentPage.id, url: currentPage.url, title: $('page-title').value, value: $('page-nickname').value });
    if (!result?.ok) throw new Error(result?.error || 'Could not save bookmark.');
    $('save-status').textContent = result.created ? 'Bookmarked with your nickname in the title!' : 'Bookmark title and nicknames updated.';
    $('page-nickname').value = '';
    await refresh();
  } catch (error) { $('save-status').textContent = error.message; $('save-status').classList.toggle('error', true); }
  finally { $('save-page').disabled = false; }
});

try {
  await refresh(); input.focus();
} catch (error) { status(`Could not load nicknames: ${error.message}`, true); }
try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !safeUrl(tab.url)) throw new Error('Open a web page to bookmark it here.');
  currentPage = { id: tab.id, url: tab.url };
  const existing = bookmarks.find(b => b.url === tab.url && aliases[b.id]?.length) || bookmarks.find(b => b.url === tab.url);
  $('page-title').value = existing ? baseTitle(existing.title, managedSuffixes[existing.id] || nicknameSuffix(aliases[existing.id])) : tab.title || tab.url;
  $('page-url').textContent = tab.url;
  $('page-hint').textContent = 'Save this page and its nickname together.';
  $('bookmark-page').disabled = false;
} catch { $('page-hint').textContent = 'Open a web page to bookmark it here.'; }
render();
await setupShortcuts();
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area === 'local' && (changes.workspaces || changes.aliases)) refresh().catch(error => status(error.message, true));
});
