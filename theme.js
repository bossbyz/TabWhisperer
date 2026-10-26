// Colour and look (v1 or v2) are user-selected; brightness always follows the system preference.
(() => {
  const { normalize, build, defaultColor } = BookmarkPalette;
  const preference = matchMedia('(prefers-color-scheme: dark)');
  let color = defaultColor;
  let storedColor = defaultColor;
  let revision = 0;
  function apply(value) {
    color = normalize(value);
    const root = document.documentElement;
    root.setAttribute('data-scheme', preference.matches ? 'dark' : 'light');
    root.style.setProperty('color-scheme', preference.matches ? 'dark' : 'light');
    for (const [key, value] of Object.entries(build(color, preference.matches))) root.style.setProperty(`--${key}`, value);
    for (const pickerId of ['primary-color', 'header-primary-color']) {
      const picker = document.getElementById(pickerId);
      if (picker) picker.value = color;
    }
    try { localStorage.setItem('primaryColor', color); } catch { /* Use the default if storage is unavailable. */ }
  }
  try { color = normalize(localStorage.getItem('primaryColor')); } catch { /* Use the default colour. */ }
  storedColor = color;
  apply(color);
  preference.addEventListener('change', () => apply(color));
  chrome.storage.local.get('primaryColor').then(saved => {
    if (!revision) { storedColor = normalize(saved.primaryColor); apply(storedColor); }
  }).catch(() => {});
  // The look is cached in localStorage too, so the right one applies before first paint.
  const normalizeLook = value => value === 'v2' ? 'v2' : 'v1';
  let look = 'v1';
  let lookRevision = 0;
  function applyLook(value, animate = false) {
    const next = normalizeLook(value);
    const update = () => {
      look = next;
      document.documentElement.setAttribute('data-look', next);
      for (const toggle of document.querySelectorAll('.look-switch')) toggle.setAttribute('aria-checked', String(next === 'v2'));
      try { localStorage.setItem('look', next); } catch { /* The stored look still applies once loaded. */ }
    };
    const changed = next !== document.documentElement.getAttribute('data-look');
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches && document.visibilityState === 'visible';
    // A skipped transition still runs update(); only its ready promise rejects.
    if (animate && changed && motion && document.startViewTransition) document.startViewTransition(update).ready.catch(() => {});
    else update();
  }
  try { look = normalizeLook(localStorage.getItem('look')); } catch { /* Use v1. */ }
  applyLook(look);
  chrome.storage.local.get('look').then(saved => { if (!lookRevision) applyLook(saved.look); }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.primaryColor) {
      revision++;
      storedColor = normalize(changes.primaryColor.newValue);
      apply(storedColor);
    }
    if (area === 'local' && changes.look) {
      lookRevision++;
      applyLook(changes.look.newValue, true);
    }
  });
  function wireLook() {
    for (const toggle of document.querySelectorAll('.look-switch')) {
      toggle.setAttribute('aria-checked', String(look === 'v2'));
      toggle.addEventListener('click', () => {
        const previous = look;
        const next = look === 'v2' ? 'v1' : 'v2';
        lookRevision++;
        applyLook(next, true);
        chrome.storage.local.set({ look: next }).catch(() => applyLook(previous, true));
      });
    }
  }
  function wire() {
    const pickers = ['primary-color', 'header-primary-color']
      .map(id => document.getElementById(id)).filter(Boolean);
    if (!pickers.length) return;
    apply(color);
    for (const picker of pickers) picker.addEventListener('input', () => { revision++; apply(picker.value); });
    async function save(value) {
      const request = ++revision;
      const status = document.getElementById('theme-status');
      status.textContent = '';
      apply(value);
      const chosen = color;
      try {
        await chrome.storage.local.set({ primaryColor: chosen });
        if (request === revision) storedColor = chosen;
      }
      catch {
        if (request === revision) {
          apply(storedColor);
          status.textContent = 'Could not save your colour. Please try again.';
        }
      }
    }
    for (const picker of pickers) picker.addEventListener('change', () => save(picker.value));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wireLook(); wire(); }, { once: true });
  else { wireLook(); wire(); }
})();
