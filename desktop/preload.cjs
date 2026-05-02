const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smartKeyDesktop', {
  runtimeConfig: {
    mode: process.env.SMARTKEY_DESKTOP_RUNTIME_MODE || '',
    apiBaseUrl: process.env.SMARTKEY_DESKTOP_API_BASE_URL || '',
  },
  getRuntimeInfo: () => ipcRenderer.invoke('smartkey:get-runtime-info'),
  openPath: (targetPath) => ipcRenderer.invoke('smartkey:open-path', targetPath),
  checkForUpdates: () => ipcRenderer.invoke('smartkey:check-for-updates'),
  getUpdateState: () => ipcRenderer.invoke('smartkey:get-update-state'),
  installUpdate: () => ipcRenderer.invoke('smartkey:install-update'),
  quitApp: () => ipcRenderer.invoke('smartkey:quit-app'),
});
