# Desktop Releases

## Branding

Desktop packaging uses the same SmartKey logo as the app UI.

Generated assets live in:

- `desktop/build/icon.svg`
- `desktop/build/icon.png`
- `desktop/build/icon.ico`

Regenerate them with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-desktop-icons.ps1
```

## Release Channels

Use these channels going forward:

- `portable`
  Internal QA, demos, and manual distribution.
- `nsis`
  Primary Windows release artifact for long-term desktop distribution.

## Commands

Portable package:

```powershell
npm run package:portable
```

Windows installer:

```powershell
npm run package:win
```

Explicit NSIS installer:

```powershell
npm run package:nsis
```

## Runtime Modes

Desktop builds now support both local and cloud-backed runtime modes.

- `local`
  Default mode. Electron starts the bundled FastAPI backend and the app uses built-in local AI, rank, and indexing configuration.
- `cloud-api`
  Set `SMARTKEY_DESKTOP_API_BASE_URL` before launch. Electron opens the bundled static frontend and sends API calls to the configured remote API base URL.
- `cloud-web`
  Set `SMARTKEY_DESKTOP_WEB_URL` before launch. Electron opens the hosted web app directly.

Runtime overrides:

```powershell
$env:SMARTKEY_DESKTOP_API_BASE_URL="https://your-api.example.com/api"
npm run desktop
```

```powershell
$env:SMARTKEY_DESKTOP_WEB_URL="https://your-web-app.example.com"
npm run desktop
```

Shortcut commands:

```powershell
$env:SMARTKEY_DESKTOP_API_BASE_URL="https://your-api.example.com/api"
npm run desktop:cloud-api
```

```powershell
$env:SMARTKEY_DESKTOP_WEB_URL="https://your-web-app.example.com"
npm run desktop:cloud-web
```

## Update Strategy

For long-term desktop releases, use the `NSIS` installer as the user-facing channel.

The desktop shell now includes `electron-updater` and exposes a manual "check for updates" action from Settings.

The default GitHub Releases update source is:

```powershell
https://github.com/niqing0922-dot/SmartKey-Deploy/releases
```

`SMARTKEY_DESKTOP_UPDATE_OWNER` and `SMARTKEY_DESKTOP_UPDATE_REPO` can still override that source for test builds.

Each formal release should upload the generated `NSIS` installer and updater metadata created by `electron-builder`, including `latest.yml`.

Portable builds should stay as a fallback channel, not the main update path.

## Packaging Notes

Windows packaging in this repo is configured for unsigned internal distribution by default.
`electron-builder` executable signing/editing is disabled so packaging can complete on machines without Windows symlink/signing privileges.
