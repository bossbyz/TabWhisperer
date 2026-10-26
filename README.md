# Tab Whisperer

Give bookmarks short nicknames, then open the right page from the keyboard or address bar. For repeatable tasks, save a **Workspace** to reopen an ordered set of pages together in its own browser window.

Tab Whisperer is a lightweight Manifest V3 extension for Microsoft Edge and Firefox. It has no build step or runtime dependencies.

## TL;DR: Get started fast

Press **Ctrl+Shift+Space** to open the launcher. Type a bookmark nickname and press **Enter** to open the page. New here? Choose **Manage nicknames** to give a bookmark a short name first, then press the shortcut and search for it. To save the page you are viewing, open the launcher and choose **Bookmark this page**.

## Features

- **Bookmark nicknames:** Find and open bookmarks with short names that are easy to remember.
- **Workspaces:** Save ordered sets of pages for tasks such as deployments, monitoring, or incident response. Choose the starting tab and add an optional nickname.
- **Quick launcher:** Search bookmarks and workspaces from the toolbar popup or keyboard shortcut.
- **Window capture:** Save supported web pages from the current window to a workspace when you explicitly choose to capture them.
- **Local settings and backups:** Nickname mappings, workspaces, and appearance settings stay in the browser profile. Export and restore backups from the manager.

## Install in Microsoft Edge

1. Download and extract the project, or download the packaged extension from **Releases**.
2. Open `edge://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose this `TabWhisperer` folder, which contains `manifest.json`.
5. Open **Tab Whisperer** from the Extensions menu and choose **Manage nicknames**.

## Install in Firefox

Firefox 140 or later is required.

1. Download and extract the project.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose `manifest.json` in this `TabWhisperer` folder.
4. Open **Tab Whisperer** from the Extensions menu and choose **Manage nicknames**.

Temporary add-ons are removed when Firefox restarts. For a permanent install, sign the package through [addons.mozilla.org](https://addons.mozilla.org/developers/) (it can be listed or kept unlisted).

## Basic use

### Add and use a bookmark nickname

1. Open the extension and choose **Manage nicknames**.
2. Find a bookmark, enter one or more nicknames separated by commas, and save.
3. Open the launcher, type a nickname, and press **Enter**.

You can also search from the address bar: type `n`, press **Space**, then type the nickname. To save the current page as a new bookmark, open the launcher, choose **Bookmark this page**, enter a nickname, and save.

### Create and open a Workspace

1. Open **Manage nicknames**, choose **Workspaces**, then **New workspace**.
2. Enter a name and, if useful, a nickname.
3. Search for bookmarks to add. Reorder the pages and choose the starting tab.
4. Save, then search for the workspace name or nickname in the launcher.

The first launch opens a dedicated window. Later launches focus that workspace's existing window. Choose **Open fresh window** or press **Ctrl+Enter** to open another. To start from open tabs, choose **Save Window as Workspace** in the launcher. The browser requests optional tab access only when you choose this action. In Firefox, the launcher opens the manager first and you choose **Use tabs from this window** to grant access, because Firefox closes the launcher popup when it shows a permission prompt.

### Keyboard shortcut

The default shortcut is **Ctrl+Shift+Space**. Change it at `edge://extensions/shortcuts` in Edge, or in Firefox open `about:addons`, choose the gear menu, then **Manage Extension Shortcuts**.

## Privacy

Tab Whisperer does not use an account, analytics, remote code, or network requests. Nickname mappings, workspaces, and appearance settings are stored locally in the browser profile. Nicknames are also added to bookmark titles; those titles may sync if browser bookmark sync is enabled.

Window capture reads supported tab titles and addresses only after you choose capture and grant the optional tabs permission. It does not capture page contents, cookies, browsing history, or sign-in state. Export backups from **Settings & backup** in the manager.

## Compatibility

Built with Manifest V3 for Microsoft Edge and Firefox 140 or later. The manifest declares both a service worker (used by Chromium) and background scripts (used by Firefox). Other Chromium-based browsers may be compatible, but are not currently verified.

In Firefox, address bar suggestions are shown as plain text because Firefox does not support Chromium's suggestion styling.

## Development

The extension has no build step or runtime dependencies. Run automated checks from the repository root:

```sh
node --test tests/*.test.mjs
```

On Windows with Edge installed, isolated browser checks are also available:

```sh
node tests/theme-browser-check.mjs
node tests/extension-browser-check.mjs
```

To package the extension on Windows, run `./scripts/package.ps1`. It creates `dist/TabWhisperer.zip`.

For Firefox, [web-ext](https://github.com/mozilla/web-ext) can lint, run, and package the extension:

```sh
npx web-ext lint
npx web-ext run
npx web-ext build
```

## License

Tab Whisperer is released under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

Some development work was done with assistance from AI tools.
