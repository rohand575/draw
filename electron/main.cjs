/* Mind Canvas — Electron main process (Windows desktop build). */
const { app, BrowserWindow, Tray, Menu, globalShortcut, shell, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
app.isQuitting = false;

const DEV_URL = process.env.VITE_DEV === 'true' ? 'http://localhost:5173' : null;
// Launched by the Windows login auto-start entry → stay hidden in the tray.
const STARTED_HIDDEN = process.argv.includes('--autostart');

// Single instance: a second launch (e.g. desktop shortcut while already running
// in the tray) just surfaces the existing window instead of spawning a copy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#15151b',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    // On login auto-start we boot straight into the tray, no window flash.
    if (STARTED_HIDDEN) return;
    mainWindow.show();
    mainWindow.focus();
  });

  // Hide to tray instead of quitting.
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Security: deny all window.open, route http(s) to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Lock navigation to the bundled app.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) e.preventDefault();
  });
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
  let image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) image = image.resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('Mind Canvas');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Canvas (Ctrl+Alt+C)', click: () => { mainWindow.show(); mainWindow.focus(); } },
      { type: 'separator' },
      { label: 'Quit Canvas', click: () => { app.isQuitting = true; app.quit(); } },
    ])
  );
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

function ensureAutoLaunch() {
  if (process.platform !== 'win32') return;
  if (!app.isPackaged) return;
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false,
      path: process.execPath,
      args: ['--autostart'],
    });
  } catch {}
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  globalShortcut.register('Control+Alt+C', toggleWindow);
  ensureAutoLaunch();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
