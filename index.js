const electron = require('electron');
const _app = process.type === 'renderer' ? electron.remote.app : electron.app;

global.CF = global.CubeFrame = {
    debug: false,

    get version() {
        return _app.getVersion();
    },

    get appName() {
        return _app.getName();
    },

    get appPath() {
        return _app.getAppPath().replace(/\\/g, '/');
    },

    get distPath() {
        return `${this.debug ? 'http://localhost:9080/' : 'http://localhost:9080/' /*'file://' + this.appPath + '/'*/}`;
    },

    get isMac() {
        return process.platform === 'darwin';
    },

    get isWin() {
        return process.platform === 'win32';
    },

    get isStandard() {
        if (typeof this._isStandard !== 'boolean') {
            const os = require('os');
            this._isStandard = parseInt(os.release()) >= 10;
        }
        return this._isStandard;
    },

    Core: electron,
    Tray: electron.Tray,
    Menu: electron.Menu,
    windowTags: new Map(),
    windowCallbacks: new Map(),

    quit() {
        _app.quit();
    }
};

const Application = require('./lib/Application.js');
const Session = require('./lib/Session.js');

global.CF.BridgeContext = require('./lib/BridgeContext.js');
global.CF.Window = require('./lib/Window.js');
global.CF.session = new Session();
global.CF.App = Application.Delegate;

global.CF.InitComponent = function (delegate) {
    // 判断应用程序是否未启动
    if (electron.app.requestSingleInstanceLock()) {
        let app = new Application();
        app.startup(delegate);
    } else {
        electron.app.exit();
    }
};

module.exports = global.CF;

