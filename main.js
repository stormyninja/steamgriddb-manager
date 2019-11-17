const {app, globalShortcut, BrowserWindow} = require('electron');
const {autoUpdater} = require('electron-updater');
const log = require('electron-log');

const path = require('path');
const url = require('url');

autoUpdater.autoInstallOnAppQuit = true;

log.catchErrors({showDialog: true});

log.info(`Started SGDB Manager ${app.getVersion()}`);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
    autoUpdater.checkForUpdatesAndNotify();
    mainWindow = new BrowserWindow({
        // width: 1600,
        // height: 900,
        width: 800,
        height: 600,
        frame:false,
        icon: path.join(__dirname, 'assets/icons/192x192.png'),
        transparent: false,
        webPreferences: {
            nodeIntegration: true,
            devTools: true
        }
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'public', 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    globalShortcut.register('CommandOrControl+Shift+L', () => {
        mainWindow.webContents.openDevTools();
    });

    mainWindow.on('beforeunload', () => {
        globalShortcut.unregisterAll();
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q

    // stormy
    // This is common, but undesirable seeing as once the window is closed it's a dead process
    //if (process.platform !== 'darwin') {
        app.quit();
    //}
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
