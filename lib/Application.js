const electron = CF.Core;

class AppDelegate {
    onLaunch() { }
    onSuspend() { }
    onExit() { }
}

class Application {
    static get Delegate() {
        return AppDelegate;
    }

    startup(delegate) {
        electron.app.on('ready', () => {
            delegate.onLaunch();
        });

        electron.app.on('window-all-closed', () => {
            electron.app.quit();
        });

        electron.app.on('will-quit', () => {
            electron.globalShortcut.unregisterAll();
        });

        electron.app.on('before-quit', (event) => {
            if (delegate.onExit() === false) {
                event.preventDefault();
            }
        });

        electron.app.on('activate', () => {
            delegate.onActivate();
        });

        // 当应用程序被第二次激活启动时
        electron.app.on('second-instance', (event, commandLine, workingDirectory) => {
            delegate.onActivate();
        });

        // 初始化扩展
        this.initExtend();
        // 初始化命令模块
        this.initCommand();
    }

    initExtend() {
        electron.BrowserWindow.prototype.setTag = function (val) {
            this.tag = val;
            CF.windowTags.set(val, this.id);
        };
        electron.BrowserWindow.prototype.getTag = function () {
            return this.tag;
        };
        electron.BrowserWindow.prototype.executeCode = function (code, callback) {
            return !(this.isDestroyed()) && this.webContents.executeJavaScript(code, true, callback);
        };
        electron.BrowserWindow.prototype.startDebug = function () {
            if (CF.debug) {
                this.webContents.openDevTools();
            }
        };
    }

    initCommand() {
        electron.ipcMain.on("command", function (e, name, ...args) {
            let cmd = {
                openItem(fullPath) {
                    electron.shell.openItem(fullPath);
                },

                showItemInFolder(fullPath) {
                    electron.shell.showItemInFolder(fullPath);
                },

                bounceDock(type) {
                    electron.app.dock.bounce(type);
                },

                openWindow(url, tag, show, options, args, callbackKey) {
                    if (options.modal === true) options.parent = electron.BrowserWindow.fromWebContents(e.sender);
                    let win = new CF.Window(options);
                    win.tag = tag;
                    win.url = url;
                    win._create(show, args, () => {
						try{
							e.sender.executeJavaScript('window.' + callbackKey + '();', true);
						}catch(e){
							console.error(e);
							}
                    });
                    e.returnValue = win.id;
                },

                getWindow(tag) {
                    let id = CF.windowTags.get(tag);
                    e.returnValue = id !== undefined ? id : null;
                },

                runWindowCallback(key) {
                    let callback = CF.windowCallbacks.get(key);
                    CF.windowCallbacks.delete(key);
                    if (typeof callback === 'function') {
                        callback();
                    }
                },

                callSessionMethod(name, ...args) {
                    let ret = typeof CF.session[name] === 'function' ? CF.session[name](...args) : undefined;
                    e.returnValue = ret !== undefined ? ret : null;
                }
            };

            if (typeof cmd[name] === 'function') {
                cmd[name](...args);
            }
        });
    }
}

module.exports = Application;