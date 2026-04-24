const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const DEFAULT_PORT = 3000;
const PACKAGED_ROOT = [
  path.join(process.resourcesPath, 'app.asar.unpacked'),
  path.join(process.resourcesPath, 'app'),
].find((candidate) => fs.existsSync(candidate));
const PROJECT_ROOT = app.isPackaged
  ? (PACKAGED_ROOT || path.join(process.resourcesPath, 'app'))
  : path.resolve(__dirname, '..');
const BACKEND_ENTRY = path.join(PROJECT_ROOT, 'backend', 'main.py');

let mainWindow = null;
let backendProcess = null;
let currentPort = DEFAULT_PORT;
let runtimeDirs = null;

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
      `Unable to start the local backend with "${python.command}".\n\n` +
      'Please make sure Python is installed and available in PATH, or set SMARTKEY_PYTHON_PATH before launch.\n\n' +
      `Original error: ${error.message}`,
    );
    app.quit();
  });
  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (!app.isQuiting && code !== 0) dialog.showErrorBox('SmartKey Backend Stopped', `The local backend exited unexpectedly with code ${code}.`);
  });
}

async function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: 'SmartKey',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await mainWindow.loadURL(appUrl);
}

async function bootstrap() {
  try {
    currentPort = await findAvailablePort(DEFAULT_PORT);
    const appUrl = `http://127.0.0.1:${currentPort}`;
    startBackend(currentPort);
    await waitForServer(appUrl);
    await createWindow(appUrl);
  } catch (error) {
    dialog.showErrorBox('SmartKey Startup Failed', error.message);
    app.quit();
  }
}

ipcMain.handle('smartkey:get-runtime-info', () => ({ platform: process.platform, appVersion: app.getVersion(), runtimeDirs }));
ipcMain.handle('smartkey:open-path', async (_, targetPath) => {
  if (!targetPath) return { status: 'error', message: 'Path is required' };
  const normalized = path.resolve(targetPath);
  const result = await shell.openPath(normalized);
  return result ? { status: 'error', message: result } : { status: 'ok', path: normalized };
});

app.whenReady().then(bootstrap);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { app.isQuiting = true; if (backendProcess) backendProcess.kill(); });
