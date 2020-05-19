const electron = CF.Core;
const events = require("events");

class Session extends events.EventEmitter {
    constructor() {
        super();
        this.attributes = new Map();
        this._logined = false;
    }

    get logined() {
        return this._getLogined();
    }

    _getLogined() {
        if (process.type === 'renderer') {
            return electron.ipcRenderer.sendSync('command', 'callSessionMethod', '_getLogined');
        } else {
            return this._logined;
        }
    }

    set(key, value) {
        if (process.type === 'renderer') {
            electron.ipcRenderer.sendSync('command', 'callSessionMethod', 'set', key, value);
        } else {
            this.attributes.set(key, value);
        }
    }

    get(key) {
        if (process.type === 'renderer') {
            return electron.ipcRenderer.sendSync('command', 'callSessionMethod', 'get', key);
        } else {
            return this.attributes.get(key);
        }
    }

    has(key) {
        if (process.type === 'renderer') {
            return electron.ipcRenderer.sendSync('command', 'callSessionMethod', 'has', key);
        } else {
            return this.attributes.has(key);
        }
    }

    remove(key) {
        if (process.type === 'renderer') {
            return electron.ipcRenderer.sendSync('command', 'callSessionMethod', 'remove', key);
        } else {
            return this.attributes.delete(key);
        }
    }

    clear() {
        if (process.type === 'renderer') {
            electron.ipcRenderer.sendSync('command', 'callSessionMethod', 'clear');
        } else {
            this.attributes.clear();
        }
    }

    login(...args) {
        if (process.type === 'renderer') {
            electron.ipcRenderer.sendSync('command', 'callSessionMethod', 'login', ...args);
        } else {
            this._logined = true;
            this.emit('login', ...args);
        }
    }

    logout(...args) {
        if (process.type === 'renderer') {
            electron.ipcRenderer.sendSync('command', 'callSessionMethod', 'logout', ...args);
        } else {
            this._logined = false;
            this.emit('logout', ...args);
        }
    }
}

module.exports = Session;