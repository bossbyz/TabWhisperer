import { safeUrl } from './core.mjs';
import { normalizeWorkspace, validateWorkspaces, resolveWorkspace } from './workspaces.mjs';

export async function captureWindow(api, windowId) {
  if (!await api.permissions.contains({ permissions: ['tabs'] })) throw new Error('Allow tab access to save this window.');
  if (!Number.isInteger(windowId)) throw new Error('Choose a browser window.');
  const window = await api.windows.get(windowId);
  if (window.incognito || window.type !== 'normal') throw new Error('Choose a regular, non-private browser window.');
  const tabs = (await api.tabs.query({ windowId })).sort((a, b) => a.index - b.index);
  const pages = tabs.filter(tab => safeUrl(tab.url));
  if (!pages.length || pages.length > 100) throw new Error('The window must contain between 1 and 100 web pages. Browser and extension pages are excluded.');
  return { entries: pages.map(tab => ({ title: tab.title || tab.url, url: tab.url })), activeIndex: Math.max(0, pages.findIndex(tab => tab.active)), skipped: tabs.length - pages.length };
}

export async function workspaceAction(api, message, bookmarks) {
  const saved = await api.storage.local.get('workspaces');
  const workspaces = validateWorkspaces(saved.workspaces || []);
  if (message.type === 'workspaceCapture') return { ok: true, ...await captureWindow(api, message.windowId) };
  if (message.type === 'workspaceSave') {
    const workspace = normalizeWorkspace(message.workspace);
    if (!message.create && !workspaces.some(w => w.id === workspace.id)) throw new Error('This workspace was deleted. Create a new workspace.');
    if (message.create && workspaces.some(w => w.id === workspace.id)) throw new Error('This workspace already exists. Refresh and retry.');
    const next = validateWorkspaces([...workspaces.filter(w => w.id !== workspace.id), workspace]);
    await api.storage.local.set({ workspaces: next });
    return { ok: true };
  }
  const workspace = workspaces.find(w => w.id === message.id);
  if (!workspace) throw new Error('This workspace no longer exists. Refresh the list.');
  if (message.type === 'workspaceDelete') {
    await api.storage.local.set({ workspaces: workspaces.filter(w => w.id !== workspace.id) });
    return { ok: true };
  }
  const { workspaceWindows = {} } = await api.storage.session.get('workspaceWindows');
  const record = workspaceWindows[workspace.id];
  if (!message.fresh && record) {
    let existing;
    try { existing = await api.windows.get(record.windowId, { populate: true }); } catch { /* Closed window. */ }
    // Check surviving original tabs as well as the ID, avoiding unrelated/recycled windows.
    if (existing && !existing.incognito && existing.tabs?.some(tab => record.tabIds.includes(tab.id))) {
      await api.windows.update(existing.id, existing.state === 'minimized' ? { focused: true, state: 'normal' } : { focused: true });
      return { ok: true, reused: true };
    }
  }
  const resolved = resolveWorkspace(workspace, bookmarks);
  const created = await api.windows.create({ url: resolved.entries.map(e => e.url), type: 'normal', focused: true, incognito: false });
  const tabs = created.tabs || await api.tabs.query({ windowId: created.id });
  // Record before selecting the starting tab so a retry can recover from a tab-selection failure.
  workspaceWindows[workspace.id] = { windowId: created.id, tabIds: tabs.map(tab => tab.id) };
  await api.storage.session.set({ workspaceWindows });
  const active = tabs.find(tab => tab.index === resolved.activeIndex) || tabs[resolved.activeIndex];
  if (active) await api.tabs.update(active.id, { active: true });
  return { ok: true, reused: false };
}
