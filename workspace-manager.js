import { flatten, safeUrl } from './core.mjs';
import { resolveWorkspace } from './workspaces.mjs';
import { sendWorkspaceMessage } from './workspace-client.mjs';
const $ = id => document.getElementById(id);
let workspaces = [], bookmarks = [], aliases = {}, draft, creating = false, busy = false;
function status(text, error = false) {
  $('workspace-status').textContent = text;
  $('workspace-status').classList.toggle('error', error);
}
function button(text, action, parent, label = text) {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = text; element.setAttribute('aria-label', label);
  element.addEventListener('click', async () => {
    if (busy) return;
    busy = true; element.disabled = true;
    try { await action(); } catch (error) { status(error.message, true); }
    finally { busy = false; element.disabled = false; }
  });
  parent.append(element);
  return element;
}
async function send(message) {
  return sendWorkspaceMessage(chrome, message);
}
async function refresh() {
  const [saved, tree] = await Promise.all([chrome.storage.local.get(['workspaces', 'aliases']), chrome.bookmarks.getTree()]);
  workspaces = saved.workspaces || [];
  aliases = saved.aliases || {};
  bookmarks = flatten(tree).filter(b => safeUrl(b.url));
  renderList();
  if (draft) renderPicker();
}
function renderList() {
  const list = $('workspace-list'); list.replaceChildren();
  if (!workspaces.length) {
    const empty = document.createElement('p'); empty.className = 'workspace-empty';
    empty.textContent = 'Your deployment desk, one shortcut away. Create a workspace from bookmarks, or save the tabs in a window.'; list.append(empty);
  }
  for (const workspace of workspaces) {
    const card = document.createElement('article'); card.className = 'workspace-card';
    const heading = document.createElement('h3'); heading.textContent = workspace.name;
    const detail = document.createElement('p'); detail.textContent = `${workspace.entries.length} tabs${workspace.nickname ? ` · ${workspace.nickname}` : ''}`;
    const preview = document.createElement('p'); preview.className = 'muted';
    preview.textContent = resolveWorkspace(workspace, bookmarks).entries.map(e => e.title).join(' · ');
    const actions = document.createElement('div'); actions.className = 'workspace-actions';
    button('Open', async () => { const r = await send({ type: 'workspaceOpen', id: workspace.id }); status(r.reused ? 'Focused your workspace window.' : 'Opened workspace in a new window.'); }, actions, `Open or focus ${workspace.name}`);
    const menu = document.createElement('details'); menu.className = 'workspace-menu';
    const toggle = document.createElement('summary'); toggle.textContent = 'More'; toggle.setAttribute('aria-label', `More actions for ${workspace.name}`); menu.append(toggle);
    const secondary = document.createElement('div'); secondary.className = 'workspace-secondary'; menu.append(secondary); actions.append(menu);
    button('Open fresh window', async () => { await send({ type: 'workspaceOpen', id: workspace.id, fresh: true }); status('Opened a fresh workspace window.'); }, secondary, `Open ${workspace.name} in a fresh window`);
    button('Edit', () => edit(workspace), secondary, `Edit ${workspace.name}`);
    button('Duplicate', () => edit({ ...workspace, id: crypto.randomUUID(), name: `${workspace.name.slice(0, 90)} copy`, nickname: '' }, true), secondary, `Duplicate ${workspace.name}`);
    button('Delete', async () => {
      if (!window.confirm(`Delete “${workspace.name}”? Its open window and bookmarks will stay open and saved.`)) return;
      await send({ type: 'workspaceDelete', id: workspace.id });
      if (draft?.id === workspace.id) cancel();
      await refresh(); status('Workspace deleted.');
    }, secondary, `Delete ${workspace.name}`);
    const copy = document.createElement('div'); copy.className = 'workspace-copy'; copy.append(heading, detail, preview);
    card.append(copy, actions); list.append(card);
  }
}
function edit(workspace, isNew = false) {
  if (draft && !window.confirm('Discard the current unsaved workspace draft?')) return;
  draft = structuredClone(resolveWorkspace(workspace, bookmarks)); creating = isNew;
  status('');
  $('workspace-name').value = draft.name; $('workspace-nickname').value = draft.nickname;
  $('workspace-editor-title').textContent = isNew ? 'New workspace' : 'Edit workspace';
  window.dispatchEvent(new Event('show-workspaces'));
  $('workspace-list').hidden = true; $('workspace-new').hidden = true;
  $('workspace-form').hidden = false; $('workspace-search').value = '';
  renderEntries(); renderPicker(); $('workspace-name').focus();
}
function cancel() { draft = undefined; $('workspace-form').hidden = true; $('workspace-list').hidden = false; $('workspace-new').hidden = false; $('workspace-new').focus(); status(''); }
function renderEntries() {
  const list = $('workspace-entries'); list.replaceChildren();
  draft.entries.forEach((entry, index) => {
    const row = document.createElement('li');
    const label = document.createElement('label'); label.className = 'workspace-start';
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'workspace-start'; radio.checked = draft.activeIndex === index;
    radio.setAttribute('aria-label', `Start on ${entry.title}`);
    radio.addEventListener('change', () => { draft.activeIndex = index; });
    const copy = document.createElement('span'); copy.textContent = entry.title;
    const address = document.createElement('small'); address.textContent = entry.url; copy.append(address);
    label.append(radio, copy); row.append(label);
    const controls = document.createElement('div'); controls.className = 'workspace-entry-actions'; row.append(controls);
    const move = delta => {
      const target = index + delta;
      [draft.entries[index], draft.entries[target]] = [draft.entries[target], draft.entries[index]];
      if (draft.activeIndex === index) draft.activeIndex = target;
      else if (draft.activeIndex === target) draft.activeIndex = index;
      renderEntries();
      $('workspace-entries').children[target].querySelector(delta < 0 ? '.move-up' : '.move-down')?.focus();
    };
    const up = button('↑', () => move(-1), controls, `Move ${entry.title} up`); up.className = 'move-up'; up.disabled = index === 0;
    const down = button('↓', () => move(1), controls, `Move ${entry.title} down`); down.className = 'move-down'; down.disabled = index === draft.entries.length - 1;
    button('Remove', () => {
      draft.entries.splice(index, 1);
      if (draft.activeIndex > index) draft.activeIndex--;
      else if (draft.activeIndex === index) draft.activeIndex = Math.min(index, draft.entries.length - 1);
      draft.activeIndex = Math.max(0, draft.activeIndex); renderEntries(); renderPicker();
    }, controls, `Remove ${entry.title}`);
    list.append(row);
  });
}
function renderPicker() {
  const list = $('workspace-bookmarks'); list.replaceChildren();
  const q = $('workspace-search').value.trim().toLowerCase();
  const available = bookmarks.filter(b => `${b.title} ${b.url} ${b.folder} ${(aliases[b.id] || []).join(' ')}`.toLowerCase().includes(q)
    && !draft.entries.some(e => e.bookmarkId === b.id || e.url === b.url));
  for (const bookmark of available.slice(0, 20)) {
    const nicknames = (aliases[bookmark.id] || []).join(', ');
    button(`+ ${bookmark.title}${nicknames ? ` · ${nicknames}` : ''}`, () => {
      if (draft.entries.length >= 100) throw new Error('Use up to 100 pages per workspace.');
      draft.entries.push({ bookmarkId: bookmark.id, title: bookmark.title, url: bookmark.url }); renderEntries(); renderPicker();
    }, list, `Add ${bookmark.title}: ${bookmark.url}`);
  }
  const hint = document.createElement('p'); hint.className = 'muted';
  hint.textContent = available.length > 20 ? `${available.length} bookmarks found. Search to narrow the list.` : available.length ? 'Select a bookmark to add it.' : 'No more matching bookmarks.';
  list.append(hint);
}
async function capture(windowId) {
  const result = await send({ type: 'workspaceCapture', windowId });
  draft.entries = result.entries.map(entry => {
    const bookmark = bookmarks.find(b => b.url === entry.url);
    return bookmark ? { ...entry, bookmarkId: bookmark.id } : entry;
  });
  draft.activeIndex = result.activeIndex;
  renderEntries(); renderPicker();
  status(`Added ${result.entries.length} web pages to the draft. ${result.skipped} browser or extension pages excluded. Save when ready.`);
}
$('workspace-new').addEventListener('click', () => { if (!busy) edit({ id: crypto.randomUUID(), name: '', nickname: '', entries: [], activeIndex: 0 }, true); });
$('workspace-cancel').addEventListener('click', () => { if (!busy) cancel(); });
$('workspace-search').addEventListener('input', renderPicker);
$('workspace-capture').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  try {
    if (!await chrome.permissions.request({ permissions: ['tabs'] })) throw new Error('Tab access was declined. Add bookmarks instead.');
    const current = await chrome.windows.getCurrent();
    await capture(current.id);
  } catch (error) { status(error.message, true); }
  finally { busy = false; }
});
$('workspace-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !draft) return;
  busy = true; $('workspace-save').disabled = true;
  try {
    await send({ type: 'workspaceSave', create: creating, workspace: { ...draft, name: $('workspace-name').value, nickname: $('workspace-nickname').value } });
    cancel(); await refresh(); status('Workspace saved. Find it by name or nickname in the launcher.');
  } catch (error) { status(error.message, true); }
  finally { busy = false; $('workspace-save').disabled = false; }
});
window.addEventListener('workspaces-refresh', () => refresh().catch(error => status(error.message, true)));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.workspaces || changes.aliases)) refresh().catch(error => status(error.message, true));
});
window.addEventListener('beforeunload', event => { if (draft) { event.preventDefault(); event.returnValue = ''; } });
refresh().then(async () => {
  const captureId = new URLSearchParams(location.search).get('captureWindow');
  if (captureId !== null) {
    history.replaceState(null, '', 'manager.html#workspaces');
    edit({ id: crypto.randomUUID(), name: '', nickname: '', entries: [], activeIndex: 0 }, true);
    await capture(Number(captureId));
  }
}).catch(error => status(error.message, true));
