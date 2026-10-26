// Firefox serves extension pages from moz-extension://; Chromium browsers use chrome-extension://.
export const isFirefox = chrome.runtime.getURL('').startsWith('moz-extension:');
const isEdge = !isFirefox && / Edg\//.test(navigator.userAgent);

export const browserName = isFirefox ? 'Firefox' : isEdge ? 'Edge' : 'your browser';
export const extensionsPage = isFirefox ? 'about:addons' : isEdge ? 'edge://extensions' : 'chrome://extensions';
// Firefox does not let extensions open about: pages, so it has no shortcut settings URL.
export const shortcutSettingsUrl = isFirefox ? '' : `${extensionsPage}/shortcuts`;
export const shortcutSettingsSteps = isFirefox
  ? 'Open about:addons, choose the gear menu, then Manage Extension Shortcuts.'
  : `Open ${shortcutSettingsUrl} in a new tab.`;
