const electron = CF.Core;
const remote = process.type === 'renderer' ? electron.remote : electron;
const BrowserWindow = remote.BrowserWindow;

class Window {
    constructor(options) {
        this.url = null;
        this.tag = null;
        this.id = null;
        this.options = options;

        this._window = null;
    }

    get window() {
        if (null === this._window) {
            if (['number', 'string'].indexOf(typeof this.id) !== -1) {
                this._window = BrowserWindow.fromId(this.id);
            }
        }
        return this._window;
    }

    _mergeOptions(options) {
        let opt = {
            frame: false,
            show: false,
            zoomToPageWidth: true,
            center: true,
            hasShadow: true,
            changeTransparent: false
        };

        let def = {
            x: 0,
            y: 0,
            width: 640,
            height: 480,
            minWidth: 0,
            minHeight: 0,
            transparent: false,
            //vibrancy: 'dark',
            fullscreenable: true,
            fullscreen: false,
            resizable: true,
            minimizable: true,
            maximizable: true,
            alwaysOnTop: false,
            skipTaskbar: false,
            titleBarStyle: 'hidden',
            modal: false,
            parent: null,
            enableLargerThanScreen: false,
            enableEdgeAdaptation: true,
            backgroundColor: '#ffffff',

            autoZoom: true,
            align: Window.Align.TopToLeft,
            showInactive: false,
            backgroundThrottling: true
        };

        for (let item in def) {
            if (def.hasOwnProperty(item)) {
                opt[item] = options.hasOwnProperty(item) && typeof options[item] === typeof def[item] ? options[item] : def[item];
            }
        }

        // Windows 10 以下的 Windows 平台启用边缘适配
        if (opt.enableEdgeAdaptation && CF.isWin && !(CF.isStandard) && !(global.IS_UNAERO_THEME)) {
            opt.width = opt.width + 20;
            opt.height = opt.height + 20;
            opt.transparent = true;
            delete opt.backgroundColor;
        } else if (opt.transparent) {
            opt.changeTransparent = true;
            delete opt.backgroundColor;
        }
        delete opt.enableEdgeAdaptation;

        let factor = Window.getZoomFactor(opt.autoZoom);
        opt.width = parseInt(opt.width * factor);
        opt.height = parseInt(opt.height * factor);
        opt.minWidth = parseInt((opt.minWidth > 0 ? opt.minWidth : (opt.width * 0.9)) * factor);
        opt.minHeight = parseInt((opt.minHeight > 0 ? opt.minHeight : (opt.height * 0.9)) * factor);

        if (typeof options.x === 'number' && typeof options.y === 'number') {
            let point = this._calcRealPoint(opt.align, opt);
            opt.x = parseInt(point.x);
            opt.y = parseInt(point.y);
        } else {
            delete opt.x;
            delete opt.y;
        }

        // 处理背景节流, 该方式目前只能无候选窗体状态下使用
        if (opt.backgroundThrottling === false) {
            opt.webPreferences = {backgroundThrottling: false};
        }
        opt.webPreferences = {webSecurity: false},
        opt.thickFrame = true;
        delete opt.backgroundThrottling;

        return opt;
    }

    _restoreOptions(cur, def, win) {
        let not = (key) => {
            return cur[key] !== def[key];
        };

        if (not('autoZoom') || not('minWidth') || not('minHeight')) {
            win.setMinimumSize(cur.minWidth, cur.minHeight);
        }

        if (not('autoZoom') || not('width') || not('height')) {
            win.setSize(cur.width, cur.height);
        }

        if (typeof cur.x === 'number' && typeof cur.y === 'number') {
            win.setPosition(cur.x, cur.y, false);
        } else {
            win.center();
        }

        if (not('vibrancy')) {
            //win.setVibrancy(cur.vibrancy);
        }

        if (not('fullscreenable')) {
            win.setFullScreenable(cur.fullscreenable);
        }

        if (not('fullscreen')) {
            win.setFullScreen(cur.fullscreen);
        }

        if (not('resizable')) {
            win.setResizable(cur.resizable);
        }

        if (not('alwaysOnTop')) {
            win.setAlwaysOnTop(cur.alwaysOnTop);
        }

        if (not('skipTaskbar')) {
            win.setSkipTaskbar(cur.skipTaskbar);
        }

        if (not('backgroundColor')) {
            win.setBackgroundColor(cur.backgroundColor);
        }
    }

    _advanceWindow(opt) {
        // 暂时只开放 Windows 平台的优化策略
        if (process.platform === 'win32') {
            // 预备下个窗体
            setTimeout(() => {
                if (null === CF.Window.nextWindow) {
                    let nextWindow = new BrowserWindow(opt);
                    nextWindow.loadURL(`file://${CF.distPath}window.html`);
                    nextWindow.webContents.once('did-finish-load', () => {
                        nextWindow.loaded = true;
                    });
                    CF.Window.nextWindow = nextWindow;
                }
            }, 0);
        }
    }

    _draw(show, args, callback) {
        const tag = typeof this.tag === 'string' ? this.tag : '' + CF.Window._generateKey();

        if (CF.windowTags.has(tag)) {
            let win = BrowserWindow.fromId(CF.windowTags.get(tag));
            win.show();
            return win.id;
        }

        let def = this._mergeOptions({}), cur = this._mergeOptions(this.options ? this.options : {});

        let hasWindow = !cur.modal && !cur.changeTransparent && null !== CF.Window.nextWindow;
        let win = hasWindow ? CF.Window.nextWindow : new BrowserWindow(cur);
        win.tag = tag;
        CF.windowTags.set(tag, win.id);

        win.on('closed', () => {
            win = null;
            CF.windowTags.delete(tag);
        });

        let showWindow = () => {
            if (show) {
                if (cur.showInactive) {
                    win.showInactive();
                } else {
                    win.show();
                }
            }
        };

        if (hasWindow) {
            // 立即清除已使用的 Window
            CF.Window.nextWindow = null;
            let cb = () => {
                win.webContents.setVisualZoomLevelLimits(1, 1);
                win.webContents.setZoomFactor(Window.getZoomFactor(cur.autoZoom));

                // let script = function (url, args, debug, key) {
                //     const fs = require('fs');
                //     let data = fs.readFileSync(url);
                //     document.write(data);
                //     const cf = require("cubeframe");
                //     cf.debug = debug;
                //     // 处理新版 electron 滚动条问题
                //     let fixScroll = '(function(dom){setTimeout(function(){dom.remove();});})(document.body.appendChild(document.createElement("iframe")))';
                //     document.write('<script>if (typeof Boot !== "undefined") Boot.Main.apply(Boot, ' + JSON.stringify(args) + ');CF.Window._runCallback(' + key + ');' + fixScroll + '</script>');
                //     document.close();
                // };
                // let key = CF.Window._generateKey();
                // CF.windowCallbacks.set(key, callback);
                // win.webContents.executeJavaScript(';(' + script.toString() + ')(' + JSON.stringify(this.url) + ', ' + JSON.stringify(args) + ', ' + CF.debug + ', ' + key + ');', true, function () {
                //     showWindow();
                // });

                showWindow();

                //  this._advanceWindow(def);
            };

            this._restoreOptions(cur, def, win);
            win.loaded ? cb() : win.webContents.once('did-finish-load', cb);

        } else {
            win.once('ready-to-show', () => {
                win.webContents.setVisualZoomLevelLimits(1, 1);
                win.webContents.setZoomFactor(Window.getZoomFactor(cur.autoZoom));

                // let script = function (args, debug) {
                //     const cf = require("cubeframe");
                //     cf.debug = debug;
                //     let dom = document.createElement('script');
                //     dom.innerHTML = 'if (typeof Boot !== "undefined") Boot.Main.apply(Boot, ' + JSON.stringify(args) + ');';
                //     document.body.appendChild(dom);
                // };
                //
                // win.webContents.executeJavaScript(';(' + script.toString() + ')(' + JSON.stringify(args) + ', ' + CF.debug + ');', true);
                callback();
                showWindow();

                //      this._advanceWindow(def);
            });
            win.loadURL(this.url);
        }

         if (CF.debug) win.openDevTools();

        this._window = win;
        return win.id;
    }

    _create(show, args, callback) {
        if (typeof args === 'function') callback = args;
        if (!(args instanceof Array)) args = [];

        let cb = () => {
            if (typeof callback === 'function') callback();
        };
        if (process.type === 'renderer') {
            const ipc = electron.ipcRenderer;
            let callbackKey = '_CUBEFRAMECALLBACK_' + CF.Window._generateKey();
            window[callbackKey] = () => {
                delete window[callbackKey];
                cb();
            };
            this.id = ipc.sendSync('command', 'openWindow', this.url, this.tag, show, this.options, args, callbackKey);
        } else {
            this.id = this._draw(show, args, cb);
        }
    }

    show(args, callback) {
        this._create(true, args, callback);
    }

    open(args, callback) {
        this._create(false, args, callback);
    }

    _calcRealPoint(align, options) {
        let point, x = options.x, y = options.y, width = options.width, height = options.height;

        let workArea = electron.screen.getPrimaryDisplay().workArea;
        switch (align) {
            case Window.Align.TopToLeft:
                point = {x: x, y: y + workArea.y};
                break;
            case Window.Align.TopToRight:
                point = {x: workArea.width + workArea.x - x - width, y: y + workArea.y};
                break;
            case Window.Align.BottomToLeft:
                point = {x: x, y: workArea.height + workArea.y - y - height};
                break;
            case Window.Align.BottomToRight:
                point = {
                    x: workArea.width + workArea.x - x - width,
                    y: workArea.height + workArea.y - y - height
                };
                break;
        }

        return point;
    }

    static _runCallback(key) {
        const ipc = electron.ipcRenderer;
        ipc.send('command', 'runWindowCallback', key);
    }

    static _generateKey() {
        let key = Date.now(), lastKey = typeof this.lastKey === 'number' ? this.lastKey : 0;
        if (key <= lastKey) {
            key = lastKey + 1;
        }
        this.lastKey = key;
        return key;
    }

    static get Align() {
        return {
            TopToLeft: 'TopToLeft',
            TopToRight: 'TopToRight',
            BottomToLeft: 'BottomToLeft',
            BottomToRight: 'BottomToRight',
            Center: 'Center'
        };
    }

    static show(name, tag, options, args, callback) {
        // if (!(options.hasOwnProperty('autoZoom'))) options.autoZoom = remote.app.getConfig('APP_AUTO_ZOOM');
        let win = new Window(options);
        win.tag = tag;
        win.url = CF.distPath + name;
        win.show(args, callback);
        return win;
    }

    static open(name, tag, options, args, callback) {
        let win = new Window(options);
        win.tag = tag;
        win.url = CF.distPath + name;
        win.open(args, callback);
        return win;
    }

    static showInModal(name, tag, options, args, callback) {
        options.modal = true;
        this.show(name, tag, options, args, callback);
    }

    static getZoomFactor(appAutoZoom) {
        // 获取屏幕的缩放比例
        let scaleFactor = electron.screen.getPrimaryDisplay().scaleFactor;
        return appAutoZoom ? 1 : 1 / scaleFactor;
    }

    static updateZoomFactor(appAutoZoom) {
        let wins = BrowserWindow.getAllWindows();
        let zoomFactor = this.getZoomFactor(appAutoZoom);
        let scaleFactor = electron.screen.getPrimaryDisplay().scaleFactor;
        for (let win of wins) {
            // 不处理截屏工具
            if (win.getTag() !== 'screenshot') {
                let size = win.getSize();
                let minimumSize = win.getMinimumSize();
                if (appAutoZoom) {
                    let width = parseInt(size[0] * scaleFactor);
                    let height = parseInt(size[1] * scaleFactor);
                    let minimumWidth = parseInt(minimumSize[0] * scaleFactor);
                    let minimumHeight = parseInt(minimumSize[1] * scaleFactor);
                    win.setMinimumSize(minimumWidth, minimumHeight);
                    win.setSize(width, height);
                } else {
                    let width = parseInt(size[0] * zoomFactor);
                    let height = parseInt(size[1] * zoomFactor);
                    let minimumWidth = parseInt(minimumSize[0] * zoomFactor);
                    let minimumHeight = parseInt(minimumSize[1] * zoomFactor);
                    win.setMinimumSize(minimumWidth, minimumHeight);
                    win.setSize(width, height);
                }

                win.webContents.setZoomFactor(zoomFactor);
            }
        }
    }

    static getWindow(tag) {
        if (process.type === 'renderer') {
            let id = electron.ipcRenderer.sendSync('command', 'getWindow', tag);
            if (null !== id) {
                return BrowserWindow.fromId(id);
            }
        } else {
            let id = CF.windowTags.get(tag);
            return ['string', 'number'].indexOf(typeof id) !== -1 ? BrowserWindow.fromId(id) : null;
        }

        return null;
    }

    static hasWindow(tag) {
        if (process.type === 'renderer') {
            let id = electron.ipcRenderer.sendSync('command', 'getWindow', tag);
            return null !== id;
        }

        return CF.windowTags.has(tag);
    }

    static getCurrentWindow() {
        return process.type === 'renderer' ? electron.remote.getCurrentWindow() : null;
    }

    static getAllWindows() {
        return BrowserWindow.getAllWindows();
    }

    static run(win, fn, host, autogc = false) {
        this.runAsContext(win.webContents, fn, host, autogc);
    }

    static runAsContext(context, fn, host, autogc = false) {
        if (this.winId === undefined) this.winId = electron.remote.getCurrentWindow().id;

        let ctx = new CF.BridgeContext(this.winId, autogc);
        ctx.start(context, fn, host);
    }
}

Window.nextWindow = null;

module.exports = Window;