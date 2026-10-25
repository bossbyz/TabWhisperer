import { safeUrl, parseAliases } from './core.mjs';

export function normalizeWorkspace(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid workspace.');
  const text = (value, max, label) => {
    if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`Invalid workspace ${label}.`);
    return value.trim();
  };
  const id = text(value.id, 100, 'ID');
  const name = text(value.name, 100, 'name');
  if (!id || !name) throw new Error('Give the workspace a name.');
  const nickname = parseAliases(value.nickname || '');
  if (nickname.length > 1) throw new Error('Use one nickname per workspace.');
  if (!Array.isArray(value.entries) || !value.entries.length || value.entries.length > 100) throw new Error('Choose between 1 and 100 pages per workspace.');
  const entries = value.entries.map(entry => {
    if (!entry || typeof entry.url !== 'string' || entry.url.length > 16384 || !safeUrl(entry.url)) throw new Error('Workspace pages must use http, https or ftp addresses.');
    const result = { title: text(entry.title || entry.url, 2000, 'page title'), url: entry.url };
    if (entry.bookmarkId !== undefined) result.bookmarkId = text(entry.bookmarkId, 100, 'bookmark ID');
    return result;
  });
  if (!Number.isInteger(value.activeIndex) || value.activeIndex < 0 || value.activeIndex >= entries.length) throw new Error('Choose a starting tab.');
  return { id, name, nickname: nickname[0] || '', entries, activeIndex: value.activeIndex };
}

export function validateWorkspaces(values) {
  if (!Array.isArray(values) || values.length > 200) throw new Error('Use up to 200 workspaces.');
  const result = values.map(normalizeWorkspace);
  const ids = new Set(), names = new Set();
  for (const workspace of result) {
    if (ids.has(workspace.id)) throw new Error('Duplicate workspace ID.');
    if (workspace.nickname && names.has(workspace.nickname)) throw new Error(`The workspace nickname “${workspace.nickname}” is already in use.`);
    ids.add(workspace.id);
    if (workspace.nickname) names.add(workspace.nickname);
  }
  return result;
}

export function resolveWorkspace(workspace, bookmarks) {
  return { ...workspace, entries: workspace.entries.map(entry => {
    const bookmark = bookmarks.find(b => b.id === entry.bookmarkId);
    return bookmark && safeUrl(bookmark.url) ? { ...entry, title: bookmark.title, url: bookmark.url } : { ...entry };
  }) };
}

export function rankWorkspaces(workspaces, query) {
  const q = query.trim().toLowerCase();
  return workspaces.map(w => ({ ...w, kind: 'workspace', score: !q ? 1 : w.nickname === q ? 100
    : w.nickname?.startsWith(q) ? 80 : w.nickname?.includes(q) ? 60 : w.name.toLowerCase().includes(q) ? 20 : 0 }))
    .filter(w => w.score).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function mergeWorkspaceBackup(incoming, current, bookmarks) {
  if (incoming === undefined) return validateWorkspaces(current);
  const restored = validateWorkspaces(incoming).map(w => ({ ...w, entries: w.entries.map(entry => {
    // Bookmark IDs belong to the source profile. Rebind only with a matching URL.
    const bookmark = bookmarks.find(b => b.id === entry.bookmarkId && b.url === entry.url) || bookmarks.find(b => b.url === entry.url);
    const { bookmarkId, ...snapshot } = entry;
    return bookmark ? { ...snapshot, bookmarkId: bookmark.id } : snapshot;
  }) }));
  const next = new Map(current.map(w => [w.id, w]));
  for (const w of restored) next.set(w.id, w);
  return validateWorkspaces([...next.values()]);
}
