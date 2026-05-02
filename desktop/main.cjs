const { app, BrowserWindow, dialog, shell, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_) {}

const DEFAULT_PORT = 3000;
const DEFAULT_UPDATE_OWNER = 'niqing0922-dot';
const DEFAULT_UPDATE_REPO = 'SmartKey-Deploy';
const PACKAGED_ROOT = [
  path.join(process.resourcesPath, 'app.asar.unpacked'),
  path.join(process.resourcesPath, 'app'),
].find((candidate) => fs.existsSync(candidate));
const PROJECT_ROOT = app.isPackaged
  ? (PACKAGED_ROOT || path.join(process.resourcesPath, 'app'))
  : path.resolve(__dirname, '..');
const BACKEND_ENTRY = path.join(PROJECT_ROOT, 'backend', 'main.py');
const WINDOW_ICON = path.join(PROJECT_ROOT, 'desktop', 'build', 'icon.png');
const FRONTEND_ENTRY = path.join(PROJECT_ROOT, 'frontend', 'dist', 'index.html');

let mainWindow = null;
let backendProcess = null;
let currentPort = DEFAULT_PORT;
let runtimeDirs = null;
let updateState = { status: 'idle', version: '', message: '' };
let desktopRuntimeMode = 'local';
let desktopApiBaseUrl = '';

function resolveCloudWebUrl() {
  return String(process.env.SMARTKEY_DESKTOP_WEB_URL || '').trim();
}

function resolveCloudApiBaseUrl() {
  return String(process.env.SMARTKEY_DESKTOP_API_BASE_URL || '').trim();
}

function resolveDesktopRuntime() {
  const cloudWebUrl = resolveCloudWebUrl();
  if (cloudWebUrl) {
    return { mode: 'cloud-web', webUrl: cloudWebUrl, apiBaseUrl: resolveCloudApiBaseUrl() };
  }
  const cloudApiBaseUrl = resolveCloudApiBaseUrl();
  if (cloudApiBaseUrl) {
    return { mode: 'cloud-api', webUrl: '', apiBaseUrl: cloudApiBaseUrl };
  }
  return { mode: 'local', webUrl: '', apiBaseUrl: '' };
}

function createRuntimeDirs() {
  const runtimeRoot = path.join(app.getPath('userData'), 'runtime');
  const dataDir = path.join(runtimeRoot, 'data');
  const backupDir = path.join(runtimeRoot, 'backups');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  runtimeDirs = { runtimeRoot, dataDir, backupDir };
  return runtimeDirs;
}

function getPythonInvocation() {
  const explicit = process.env.SMARTKEY_PYTHON_PATH;
  if (explicit) {
    return { command: explicit, args: ['-m', 'uvicorn', 'backend.main:app'] };
  }
  if (process.platform === 'win32') {
    return { command: 'python', args: ['-m', 'uvicorn', 'backend.main:app'] };
  }
  return { command: 'python3', args: ['-m', 'uvicorn', 'backend.main:app'] };
}

function updateMenuState() {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  const installItem = menu.getMenuItemById('smartkey.install-update');
  if (installItem) installItem.enabled = updateState.status === 'downloaded';
}

function buildUpdateMessage(result) {
  if (!result) return 'Update check completed.';
  if (result.status === 'not-configured') return result.message || 'Desktop update source is not configured.';
  if (result.status === 'update-not-available') return result.message || 'Already on the latest version.';
  if (result.status === 'update-available') return result.message || `Update ${result.version || ''} is downloading.`;
  if (result.status === 'downloaded') return result.message || `Update ${result.version || ''} is ready to install on restart.`;
  if (result.status === 'checking') return result.message || 'Checking for updates.';
  if (result.status === 'error') return result.message || 'Failed to check for updates.';
  return result.message || 'Update check completed.';
}

function configureAutoUpdater() {
  const owner = String(process.env.SMARTKEY_DESKTOP_UPDATE_OWNER || DEFAULT_UPDATE_OWNER).trim();
  const repo = String(process.env.SMARTKEY_DESKTOP_UPDATE_REPO || DEFAULT_UPDATE_REPO).trim();
  if (!autoUpdater || !owner || !repo) return false;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({ provider: 'github', owner, repo });
  autoUpdater.on('checking-for-update', () => {
    updateState = { status: 'checking', version: '', message: 'Checking for updates.' };
    updateMenuState();
  });
  autoUpdater.on('update-available', (info) => {
    updateState = { status: 'update-available', version: info.version || '', message: 'Downloading update.' };
    updateMenuState();
  });
  autoUpdater.on('update-not-available', (info) => {
    updateState = { status: 'update-not-available', version: info?.version || '', message: 'Already on the latest version.' };
    updateMenuState();
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateState = { status: 'downloaded', version: info.version || '', message: 'Update downloaded and ready to install on restart.' };
    updateMenuState();
  });
  autoUpdater.on('error', (error) => {
    updateState = { status: 'error', version: '', message: error.message };
    updateMenuState();
  });
  return true;
}

async function checkForUpdates() {
  const owner = String(process.env.SMARTKEY_DESKTOP_UPDATE_OWNER || DEFAULT_UPDATE_OWNER).trim();
  const repo = String(process.env.SMARTKEY_DESKTOP_UPDATE_REPO || DEFAULT_UPDATE_REPO).trim();
  if (!autoUpdater || !owner || !repo) {
    return { status: 'not-configured', message: 'Desktop update source is not configured.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result?.downloadPromise) {
      updateState = { status: 'update-available', version: result.updateInfo?.version || '', message: 'Downloading update.' };
      updateMenuState();
      return updateState;
    }
    const nextState = updateState.status === 'idle'
      ? { status: 'update-not-available', version: app.getVersion(), message: 'Already on the latest version.' }
      : updateState;
    updateState = nextState;
    updateMenuState();
    return nextState;
  } catch (error) {
    updateState = { status: 'error', version: '', message: error.message };
    updateMenuState();
    return updateState;
  }
}

function installDownloadedUpdate() {
  if (autoUpdater && updateState.status === 'downloaded') {
    autoUpdater.quitAndInstall(false, true);
    return { status: 'installing', message: 'Installing downloaded update.' };
  }
  app.quit();
  return { status: 'quit', message: 'Closing application.' };
}

function showUpdateDialog(result) {
  return dialog.showMessageBox({
    type: result?.status === 'error' ? 'error' : 'info',
    title: 'SmartKey Update',
    message: buildUpdateMessage(result),
  });
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const appSubmenu = [
    ...(isMac ? [{ role: 'about' }, { type: 'separator' }] : []),
    {
      id: 'smartkey.check-updates',
      label: 'Check for Updates',
      click: async () => {
        const result = await checkForUpdates();
        await showUpdateDialog(result).catch(() => undefined);
      },
    },
    {
      id: 'smartkey.install-update',
      label: 'Install Downloaded Update',
      enabled: updateState.status === 'downloaded',
      click: () => {
        installDownloadedUpdate();
      },
    },
    { type: 'separator' },
    ...(isMac
      ? [{ role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }]
      : []),
    isMac ? { label: 'Exit', role: 'quit' } : { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() },
  ];

  const template = [
    { label: isMac ? app.name : 'SmartKey', submenu: appSubmenu },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ role: 'front' }, { type: 'separator' }, { role: 'window' }] : [{ role: 'close' }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') return resolve(findAvailablePort(startPort + 1));
      reject(error);
    });
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 40000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Backend did not become ready within ${timeoutMs}ms`);
}

function startBackend(port) {
  if (!fs.existsSync(BACKEND_ENTRY)) throw new Error(`Backend entry not found: ${BACKEND_ENTRY}`);
  const { dataDir, backupDir } = createRuntimeDirs();
  const python = getPythonInvocation();
  backendProcess = spawn(python.command, [...python.args, '--host', '127.0.0.1', '--port', String(port)], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, SMARTKEY_DATA_DIR: dataDir, SMARTKEY_BACKUP_DIR: backupDir },
    stdio: 'inherit',
  });
  backendProcess.on('error', (error) => {
    dialog.showErrorBox(
      'SmartKey Backend Failed',
      `Unable to start the local backend with "${python.command}".\n\n`
      + 'Please make sure Python is installed and available in PATH, or set SMARTKEY_PYTHON_PATH before launch.\n\n'
      + `Original error: ${error.message}`,
    );
    app.quit();
  });
  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (!app.isQuiting && code !== 0) {
      dialog.showErrorBox('SmartKey Backend Stopped', `The local backend exited unexpectedly with code ${code}.`);
    }
  });
}

async function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: 'SmartKey',
    icon: fs.existsSync(WINDOW_ICON) ? WINDOW_ICON : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (appUrl) {
    await mainWindow.loadURL(appUrl);
    return;
  }
  if (!fs.existsSync(FRONTEND_ENTRY)) {
    throw new Error(`Frontend build not found: ${FRONTEND_ENTRY}`);
  }
  await mainWindow.loadFile(FRONTEND_ENTRY);
}

async function bootstrap() {
  try {
    configureAutoUpdater();
    createApplicationMenu();

    const runtime = resolveDesktopRuntime();
    desktopRuntimeMode = runtime.mode;
    desktopApiBaseUrl = runtime.apiBaseUrl;
    process.env.SMARTKEY_DESKTOP_RUNTIME_MODE = desktopRuntimeMode;
    process.env.SMARTKEY_DESKTOP_API_BASE_URL = desktopApiBaseUrl;

    if (runtime.mode === 'cloud-web') {
      await createWindow(runtime.webUrl);
      return;
    }
    if (runtime.mode === 'cloud-api') {
      await createWindow('');
      return;
    }

    currentPort = await findAvailablePort(DEFAULT_PORT);
    const appUrl = `http://127.0.0.1:${currentPort}`;
    desktopApiBaseUrl = `${appUrl}/api`;
    process.env.SMARTKEY_DESKTOP_API_BASE_URL = desktopApiBaseUrl;
    startBackend(currentPort);
    await waitForServer(appUrl);
    await createWindow(appUrl);
  } catch (error) {
    dialog.showErrorBox('SmartKey Startup Failed', error.message);
    app.quit();
  }
}

ipcMain.handle('smartkey:get-runtime-info', () => ({
  platform: process.platform,
  appVersion: app.getVersion(),
  runtimeDirs,
  mode: desktopRuntimeMode,
  apiBaseUrl: desktopApiBaseUrl,
}));

ipcMain.handle('smartkey:open-path', async (_, targetPath) => {
  if (!targetPath) return { status: 'error', message: 'Path is required' };
  const normalized = path.resolve(targetPath);
  const result = await shell.openPath(normalized);
  return result ? { status: 'error', message: result } : { status: 'ok', path: normalized };
});

ipcMain.handle('smartkey:check-for-updates', async () => checkForUpdates());
ipcMain.handle('smartkey:get-update-state', () => updateState);
ipcMain.handle('smartkey:install-update', () => installDownloadedUpdate());
ipcMain.handle('smartkey:quit-app', () => {
  app.quit();
  return { status: 'quit' };
});

app.whenReady().then(bootstrap);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  app.isQuiting = true;
  if (backendProcess) backendProcess.kill();
});
