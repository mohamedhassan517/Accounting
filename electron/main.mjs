import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  const startUrl = process.env.ELECTRON_START_URL;
  const isDev = !!startUrl || !app.isPackaged;

  if (isDev && startUrl) {
    win.loadURL(startUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'spa', 'index.html');
    win.loadFile(indexPath);
  }
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
