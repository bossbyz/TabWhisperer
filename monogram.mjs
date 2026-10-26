// Letter and stable hue offset for the glass look's avatar tiles. The classic look ignores both.
export function monogram(element, text = '') {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)) | 0;
  element.dataset.initial = [...text.trim()][0]?.toUpperCase() || '•';
  element.style.setProperty('--hue', String((Math.abs(hash) % 90) - 45));
}
