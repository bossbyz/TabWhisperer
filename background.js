import { flatten, rank, escapeXml, parseAliases, validateUnique, mergeBackup, safeUrl } from './core.mjs';
import { commitBookmarks } from './bookmark-store.mjs';
import { mergeWorkspaceBackup } from './workspaces.mjs';
import { workspaceAction } from './workspace-service.mjs';

async function state() {
  const [tree, saved] = await Promise.all([chrome.bookmarks.getTree(), chrome.storage.local.get(['aliases', 'managedSuffixes'])]);
  const bookmarks = flatten(tree);
  const ids = new Set(bookmarks.map(b => b.id));
  const aliases = Object.fromEntries(Object.entries(saved.aliases || {}).filter(([id]) => ids.has(id)));
  const managedSuffixes = Object.fromEntries(Object.entries(saved.managedSuffixes || {}).filter(([id]) => ids.has(id)));
  return { bookmarks, aliases, managedSuffixes };
}

const help = 'Type a nickname, e.g. <match>tote</match> — manage nicknames from the toolbar icon';
let generation = 0;
chrome.omnibox.onInputStarted.addListener(() => { generation++; chrome.omnibox.setDefaultSuggestion({ description: help }); });
chrome.omnibox.onInputCancelled.addListener(() => { generation++; });
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const request = ++generation;
  try {
    const { bookmarks, aliases } = await state();
    if (request !== generation) return;
    const matches = rank(bookmarks, aliases, text);
    chrome.omnibox.setDefaultSuggestion({ description: matches.length
      ? `Open <match>${escapeXml(matches[0].aliases.join(', '))}</match> — <dim>${escapeXml(matches[0].title)}</dim> — <url>${escapeXml(matches[0].url)}</url>`
      : 'No matching nickname — Enter opens your nickname manager' });
    suggest(matches.map(b => ({ content: b.url, description: `<match>${escapeXml(b.aliases.join(', '))}</match> — ${escapeXml(b.title)} — <url>${escapeXml(b.url)}</url>` })));
  } catch { if (request === generation) suggest([]); }
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  generation++;
  const { bookmarks, aliases } = await state();
  // Only navigate to a known nicknamed bookmark, even if input looks like a URL.
  const known = bookmarks.find(b => b.url === text && aliases[b.id]?.length && rank([b], aliases, '', 1).length);
  const match = known || rank(bookmarks, aliases, text, 1)[0];
  const url = match?.url || chrome.runtime.getURL('manager.html');
  if (disposition === 'currentTab') await chrome.tabs.update({ url });
  else await chrome.tabs.create({ url, active: disposition !== 'newBackgroundTab' });
});

// Serialize read-modify-write operations from multiple manager windows.
let writes = Promise.resolve();
// Upgrade existing local nicknames to bracketed bookmark titles on install/update/reload.
chrome.runtime.onInstalled.addListener(() => {
  writes = writes.catch(() => {}).then(async () => {
    const { bookmarks, aliases, managedSuffixes } = await state();
    await commitBookmarks(chrome, bookmarks, aliases, managedSuffixes, Object.keys(aliases));
  });
  writes.catch(error => console.error('Could not update nickname titles:', error.message));
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !['save', 'import', 'savePage', 'workspaceSave', 'workspaceDelete', 'workspaceOpen', 'workspaceCapture'].includes(message?.type)) return;
  writes = writes.catch(() => {}).then(async () => {
    const { bookmarks, aliases, managedSuffixes } = await state();
    if (message.type.startsWith('workspace')) return workspaceAction(chrome, message, bookmarks);
    if (message.type === 'savePage') {
      const values = parseAliases(message.value);
      if (!values.length) throw new Error('Enter at least one nickname.');
      const tab = await chrome.tabs.get(message.tabId);
      if (!safeUrl(tab.url)) throw new Error('Open a web page before saving a bookmark.');
      if (tab.url !== message.url) throw new Error('The page changed. Reopen the launcher to bookmark the current page.');
      const existing = bookmarks.find(b => b.url === tab.url && aliases[b.id]?.length)
        || bookmarks.find(b => b.url === tab.url);
      const id = existing?.id || 'new-bookmark';
      const next = { ...aliases, [id]: parseAliases([...(aliases[id] || []), ...values]) };
      validateUnique(next);
      let created;
      if (!existing) {
        created = await chrome.bookmarks.create({ title: tab.title || tab.url, url: tab.url });
        next[created.id] = next[id];
        delete next[id];
      }
      try {
        const titleEdits = Object.hasOwn(message, 'title') ? { [created?.id || id]: message.title } : {};
        await commitBookmarks(chrome, created ? [...bookmarks, created] : bookmarks, next, managedSuffixes, [created?.id || id], titleEdits);
      } catch (error) {
        if (created) {
          try { await chrome.bookmarks.remove(created.id); }
          catch { throw new Error('The bookmark was created, but its nickname could not be saved. Retry to add the nickname.'); }
        }
        throw error;
      }
      return { ok: true, created: Boolean(created) };
    }
    if (message.type === 'save') {
      if (!bookmarks.some(b => b.id === message.id)) throw new Error('This bookmark no longer exists. Refresh the list.');
      const values = parseAliases(message.value);
      if (values.length) aliases[message.id] = values;
      else delete aliases[message.id];
      validateUnique(aliases);
      const titleEdits = Object.hasOwn(message, 'title') ? { [message.id]: message.title } : {};
      await commitBookmarks(chrome, bookmarks, aliases, managedSuffixes, [message.id], titleEdits);
      return { ok: true };
    }
    const { next, matched } = mergeBackup(message.data, bookmarks, aliases);
    const saved = await chrome.storage.local.get('workspaces');
    const workspaces = mergeWorkspaceBackup(message.data.workspaces, saved.workspaces || [], bookmarks);
    await commitBookmarks(chrome, bookmarks, next, managedSuffixes, Object.keys(next), {}, { workspaces });
    return { ok: true, matched, workspaceCount: message.data.workspaces?.length || 0 };
  });
  writes.then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});
