const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smartKeyDesktop', {
  getRuntimeInfo: () => ipcRenderer.invoke('smartkey:get-runtime-info'),
  openPath: (targetPath) => ipcRenderer.invoke('smartkey:open-path', targetPath),
});
