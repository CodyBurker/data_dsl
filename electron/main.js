const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, '..', 'docs', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PipeData Script', extensions: ['pd', 'txt'] }]
  });
  if (canceled || filePaths.length === 0) return null;
  const fs = require('fs');
  return fs.promises.readFile(filePaths[0], 'utf8');
});

ipcMain.handle('saveFile', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'PipeData Script', extensions: ['pd'] }]
  });
  if (canceled || !filePath) return null;
  const fs = require('fs');
  await fs.promises.writeFile(filePath, content, 'utf8');
  return true;
});

module.exports = { createWindow };
