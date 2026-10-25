export const reloadGuidance = 'The extension did not respond. Open edge://extensions, click Reload for Tab Whisperer, then reopen the manager. If you are editing a workspace, keep a copy of its details before reloading.';

// A freshly updated extension page can still be talking to the previous worker
// until Edge reloads the extension. Unknown message types resolve without a reply.
// Never retry a mutation automatically: the first call may already have saved.
export async function sendWorkspaceMessage(api, message) {
  let response;
  try { response = await api.runtime.sendMessage(message); }
  catch (error) {
    if (/extension context invalidated|receiving end does not exist|message port closed|message channel closed/i.test(error.message || '')) throw new Error(reloadGuidance);
    throw error;
  }
  if (!response || typeof response.ok !== 'boolean') throw new Error(reloadGuidance);
  if (!response.ok) throw new Error(response.error || 'The workspace could not be saved or opened. Reload the extension at edge://extensions and try again.');
  return response;
}
