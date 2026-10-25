// Derive matching surfaces and readable accents from any sRGB primary colour.
(() => {
  const defaultColor = '#5aa9e6';
  const normalize = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : defaultColor;
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  function luminance(hex) {
    const values = rgb(hex).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function toHsl(hex) {
    const [r, g, b] = rgb(hex), high = Math.max(r, g, b), low = Math.min(r, g, b);
    const delta = high - low, l = (high + low) / 2;
    if (!delta) return [0, 0, l * 100];
    const s = delta / (1 - Math.abs(2 * l - 1));
    const h = high === r ? ((g - b) / delta + 6) % 6 : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return [h * 60, s * 100, l * 100];
  }
  function hex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const component = n => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return `#${component(0)}${component(8)}${component(4)}`;
  }
  function build(value, dark) {
    const color = normalize(value), [h, s, originalLightness] = toHsl(color);
    const tone = (saturation, lightness) => hex(h, Math.min(s, saturation), lightness);
    const surface = tone(35, dark ? 22 : 90);
    let accent = color, lightness = originalLightness;
    // Keep the chosen hue; adjust brightness only when needed for readable text.
    for (let i = 0; contrast(accent, surface) < 4.6 && i < 101; i++) {
      lightness = Math.max(0, Math.min(100, lightness + (dark ? 1 : -1)));
      accent = hex(h, s, lightness);
    }
    return {
      bg: tone(18, dark ? 8 : 98), text: tone(24, dark ? 94 : 12),
      muted: tone(16, dark ? 73 : 32), subtle: tone(12, dark ? 67 : 38),
      input: dark ? tone(16, 6) : '#ffffff', border: tone(16, dark ? 25 : 80),
      'input-border': tone(16, dark ? 48 : 52), button: tone(24, dark ? 17 : 94),
      'button-hover': surface, accent, 'accent-button': accent,
      'on-accent': contrast(accent, '#ffffff') >= contrast(accent, '#000000') ? '#ffffff' : '#000000',
      selected: tone(35, dark ? 18 : 93), 'selected-border': accent,
      panel: tone(25, dark ? 15 : 95), 'panel-border': tone(25, dark ? 35 : 72),
      link: accent, 'success-bg': tone(30, dark ? 17 : 93), 'success-text': accent,
      'error-bg': dark ? '#4b2429' : '#fce8e9', 'error-text': dark ? '#ffbfc6' : '#a52436',
      shadow: dark ? '#0004' : '#0002'
    };
  }
  globalThis.BookmarkPalette = Object.freeze({ defaultColor, normalize, build, contrast });
})();
