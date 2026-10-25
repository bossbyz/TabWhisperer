import { baseTitle, bookmarkTitle, nicknameSuffix } from './core.mjs';

// Bookmark titles and local storage are separate APIs. Undo title edits if either write fails.
export async function commitBookmarks(api, bookmarks, aliases, managedSuffixes, ids, titleEdits = {}, extraStorage = {}) {
  const nextSuffixes = { ...managedSuffixes };
  const changed = [];
  try {
    for (const id of new Set(ids)) {
      const bookmark = bookmarks.find(b => b.id === id);
      if (!bookmark) throw new Error('This bookmark no longer exists. Refresh the list.');
      // A restored/synced title may already contain the desired suffix without local metadata.
      const suffix = nicknameSuffix(aliases[id]);
      const base = baseTitle(Object.hasOwn(titleEdits, id) ? titleEdits[id] : bookmark.title, managedSuffixes[id] || suffix);
      const title = bookmarkTitle(base, aliases[id] || []);
      if (title !== bookmark.title) {
        await api.bookmarks.update(id, { title });
        changed.push({ id, title: bookmark.title });
      }
      if (suffix) nextSuffixes[id] = suffix;
      else delete nextSuffixes[id];
    }
    await api.storage.local.set({ ...extraStorage, aliases, managedSuffixes: nextSuffixes });
  } catch (error) {
    let rollbackFailed = false;
    for (const bookmark of changed.reverse()) {
      try { await api.bookmarks.update(bookmark.id, { title: bookmark.title }); }
      catch { rollbackFailed = true; }
    }
    if (rollbackFailed) throw new Error('Saving failed and some bookmark titles could not be restored. Refresh the list and check those titles before retrying.');
    throw error;
  }
}
