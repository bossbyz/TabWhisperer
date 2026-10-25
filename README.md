# Tab Whisperer

Give bookmarks short nicknames, then open the right page from the keyboard or address bar. For repeatable tasks, save a **Workspace** to reopen an ordered set of pages together in its own browser window.

Tab Whisperer is a lightweight Microsoft Edge extension built with Manifest V3. It has no build step or runtime dependencies.

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

## Basic use

### Add and use a bookmark nickname

1. Open the extension and choose **Manage nicknames**.
2. Find a bookmark, enter one or more nicknames separated by commas, and save.
3. Open the launcher, type a nickname, and press **Enter**.

You can also search from Edge's address bar: type `n`, press **Space**, then type the nickname. To save the current page as a new bookmark, open the launcher, choose **Bookmark this page**, enter a nickname, and save.

### Create and open a Workspace

1. Open **Manage nicknames**, choose **Workspaces**, then **New workspace**.
2. Enter a name and, if useful, a nickname.
3. Search for bookmarks to add. Reorder the pages and choose the starting tab.
4. Save, then search for the workspace name or nickname in the launcher.

The first launch opens a dedicated window. Later launches focus that workspace's existing window. Choose **Open fresh window** or press **Ctrl+Enter** to open another. To start from open tabs, choose **Save Window as Workspace** in the launcher. Edge requests optional tab access only when you choose this action.

### Keyboard shortcut

The default shortcut is **Ctrl+Shift+Space**. Change it at `edge://extensions/shortcuts`.

## Privacy

Tab Whisperer does not use an account, analytics, remote code, or network requests. Nickname mappings, workspaces, and appearance settings are stored locally in the browser profile. Nicknames are also added to bookmark titles; those titles may sync if browser bookmark sync is enabled.

Window capture reads supported tab titles and addresses only after you choose capture and grant the optional tabs permission. It does not capture page contents, cookies, browsing history, or sign-in state. Export backups from **Settings & backup** in the manager.

## Compatibility

Built for Microsoft Edge with Manifest V3. Other Chromium-based browsers may be compatible, but are not currently verified. Firefox compatibility has not been verified.

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

## License

Tab Whisperer is released under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

Some development work was done with assistance from AI tools.
