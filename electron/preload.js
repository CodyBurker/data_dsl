import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal API for file operations. The main process performs the
// actual disk access so the renderer stays sandboxed.

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('openFile'),
  saveFile: (content) => ipcRenderer.invoke('saveFile', content)
});
