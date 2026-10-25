export function flatten(nodes, folder = '') {
  return nodes.flatMap(node => node.url
    ? [{ id: node.id, title: node.title ?? node.url, url: node.url, folder }]
    : flatten(node.children || [], [folder, node.title].filter(Boolean).join(' / ')));
}

export function nicknameSuffix(aliases = []) {
  return aliases.length ? `(${aliases.join(',')})` : '';
}

// Only remove a suffix recorded as ours. Unrelated bracketed title text is preserved.
export function baseTitle(title, managedSuffix = '') {
  if (typeof title !== 'string') throw new Error('Enter a valid bookmark title.');
  if (managedSuffix && title === managedSuffix) return '';
  if (managedSuffix && title.endsWith(` ${managedSuffix}`)) return title.slice(0, -managedSuffix.length - 1);
  return title;
}

export function bookmarkTitle(title, aliases = []) {
  if (typeof title !== 'string' || /[\x00-\x1f\x7f]/.test(title)) throw new Error('Enter a valid bookmark title.');
  const base = title.trim();
  const suffix = nicknameSuffix(aliases);
  return [base, suffix].filter(Boolean).join(' ');
}

export function safeUrl(value) {
  try { return ['https:', 'http:', 'ftp:'].includes(new URL(value).protocol); }
  catch { return false; }
}

export function parseAliases(value) {
  const aliases = [...new Set((Array.isArray(value) ? value : String(value).split(','))
    .map(item => {
      if (typeof item !== 'string') throw new Error('Nicknames must be text.');
      if (/[\x00-\x1f\x7f]/.test(item)) throw new Error('Nicknames cannot contain control characters.');
      return item.trim().replace(/\s+/g, ' ').toLowerCase();
    }).filter(Boolean))];
  if (aliases.length > 12 || aliases.some(a => a.length > 64 || /[\x00-\x1f\x7f,]/.test(a))) {
    throw new Error('Use up to 12 nicknames, each under 65 characters, separated by commas.');
  }
  return aliases;
}

export function validateUnique(map) {
  const owners = new Map();
  for (const [id, aliases] of Object.entries(map)) {
    for (const alias of parseAliases(aliases)) {
      if (owners.has(alias) && owners.get(alias) !== id) throw new Error(`The nickname “${alias}” is already used by another bookmark.`);
      owners.set(alias, id);
    }
  }
}

export function rank(bookmarks, map, query, limit = 6) {
  const q = query.trim().toLowerCase();
  return bookmarks.filter(b => safeUrl(b.url) && map[b.id]?.length).map(b => {
    const aliases = map[b.id];
    let score = 0;
    if (!q) score = 1;
    else if (aliases.includes(q)) score = 100;
    else if (aliases.some(a => a.startsWith(q))) score = 80;
    else if (aliases.some(a => a.includes(q))) score = 60;
    else if (`${b.title} ${b.url}`.toLowerCase().includes(q)) score = 20;
    return { ...b, aliases, score };
  }).filter(b => b.score).sort((a, b) => b.score - a.score || a.aliases[0].localeCompare(b.aliases[0]) || a.id.localeCompare(b.id)).slice(0, limit);
}

export function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
}

export function mergeBackup(data, bookmarks, current) {
  if (data?.format !== 'bookmark-nicknames' || data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 20000) {
    throw new Error('This is not a supported Bookmark Nicknames backup.');
  }
  const next = Object.assign(Object.create(null), current);
  let matched = 0;
  for (const entry of data.entries) {
    if (!entry || typeof entry.url !== 'string' || !safeUrl(entry.url) || !Array.isArray(entry.aliases)) throw new Error('The backup contains an invalid entry.');
    const aliases = parseAliases(entry.aliases);
    // Match by URL, because bookmark IDs change between browser profiles.
    const bookmark = bookmarks.find(b => b.url === entry.url && b.id === entry.id)
      || bookmarks.find(b => b.url === entry.url);
    if (bookmark && aliases.length) {
      next[bookmark.id] = parseAliases([...(next[bookmark.id] || []), ...aliases]);
      matched++;
    }
  }
  validateUnique(next);
  return { next, matched };
}
