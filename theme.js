// Colour and the glass look are user-selected; brightness always follows the system preference.
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
  // Glass defaults to on. It is cached in localStorage too, so the right look applies before first paint.
  const normalizeGlass = value => value !== false && value !== 'false';
  let glass = true;
  let glassRevision = 0;
  function applyGlass(value, animate = false) {
    const next = normalizeGlass(value);
    const update = () => {
      glass = next;
      document.documentElement.toggleAttribute('data-glass', next);
      for (const input of document.querySelectorAll('.glass-input')) input.checked = next;
      try { localStorage.setItem('glass', String(next)); } catch { /* The stored setting still applies once loaded. */ }
    };
    const changed = next !== document.documentElement.hasAttribute('data-glass');
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches && document.visibilityState === 'visible';
    // A skipped transition still runs update(); only its ready promise rejects.
    if (animate && changed && motion && document.startViewTransition) document.startViewTransition(update).ready.catch(() => {});
    else update();
  }
  try { glass = normalizeGlass(localStorage.getItem('glass')); } catch { /* Use the default. */ }
  applyGlass(glass);
  chrome.storage.local.get('glass').then(saved => { if (!glassRevision) applyGlass(saved.glass); }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.primaryColor) {
      revision++;
      storedColor = normalize(changes.primaryColor.newValue);
      apply(storedColor);
    }
    if (area === 'local' && changes.glass) {
      glassRevision++;
      applyGlass(changes.glass.newValue, true);
    }
  });
  function wireGlass() {
    for (const input of document.querySelectorAll('.glass-input')) {
      input.checked = glass;
      input.addEventListener('change', () => {
        const previous = glass;
        glassRevision++;
        applyGlass(input.checked, true);
        chrome.storage.local.set({ glass: input.checked }).catch(() => applyGlass(previous, true));
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wireGlass(); wire(); }, { once: true });
  else { wireGlass(); wire(); }
})();
