const electron = CF.Core;
const BrowserWindow = process.type === 'renderer' ? electron.remote.BrowserWindow : electron.BrowserWindow;

class BridgeContext {
    constructor(id, autogc = false) {
        this.context = [];
        this.id = id;
        this.key = CF.Window._generateKey();
        this.hasFunction = false;
        this.autogc = autogc;
        this.callbacks = new Map();
    }

    static Add(key, value) { this.Hosts.set(key, value); }
    static Del(key) { this.Hosts.delete(key); }
    static Get(key) { return this.Hosts.get(key); }

    static Call(opt, args) {
        let map = this.Get(opt.key);
        if (map instanceof Map) {
            try {
                map.get(opt.name)(...args);
            } catch (e) {
                console.error('[BridgeContext#Call] 跨窗体回调失败', e);
            }
            if (opt.autogc) {
                map.delete(opt.name);
                if (map.size === 0) this.Del(opt.key);
            }
        }
    }

    static Exec(opt, args) {
        let win = BrowserWindow.fromId(opt.id);
        if (win) {
            win.webContents.executeJavaScript('CF.BridgeContext.Call(' + JSON.stringify(opt) + ', ' + JSON.stringify(args) + ')', true);
        }
    }

    static Release(id, key) {
        let win = BrowserWindow.fromId(id);
        if (win) {
            win.webContents.executeJavaScript('CF.BridgeContext.Del(' + JSON.stringify(key) + ')', true);
        }
    }

    append(name, value, json = true) {
        let data = json ? (name + ': ') : '';
        if (typeof value === 'function') {
            this.hasFunction = true;
            let params = {id: this.id, key: this.key, name, autogc: this.autogc };
            data += 'function(...args) { CF.BridgeContext.Exec(' + JSON.stringify(params) + ', args); }';
            this.callbacks.set(name, value);
        } else {
            data += JSON.stringify(value);
        }

        this.context.push(data);
    }

    getContext() {
        let context = this.context;
        if (context.length > 0 && !this.autogc) {
            let fun = this.hasFunction ? 'CF.BridgeContext.Release.apply(null, ' + JSON.stringify([this.id, this.key]) + ');' : '';
            context.push('close: function() { ' + fun + ' }');
        }
        return '{\n\t' + context.join(', \n\t') + '\n}';
    }

    exec(content, fun, context, callback) {
        let scripts = '(' + fun.toString() + ')(' + context + ');';

        let task = (ctx, code, keys, cb) => {
            let state = ctx.isDestroyed() ? false : ctx.executeJavaScript(code, true, cb);
            if (!state) {
                for (let key of keys) BridgeContext.Del(key);
            }
        };

        if (typeof callback === 'function') {
            setTimeout(() => {
                task(content, scripts, [this.key], callback);
            }, 0);
        } else {
            if (content.execute === undefined) {
                let timer, codes = '', keys = [];
                content.execute = (ctx, code, key) => {
                    clearTimeout(timer);
                    codes += code;
                    keys.push(key);
                    timer = setTimeout(() => {
                        task(ctx, codes, keys);
                        codes = '';
                        keys = [];
                    }, 0);
                };
            }

            content.execute(content, scripts, this.key);
        }
    }

    start(content, code, host) {
        let callback, context = '';

        if (host instanceof Array && host.length > 0) {
            host.forEach((value, index) => {
                this.append(index, value, false);
            });

            context = this.context.join(', ');
        } else if (null !== host && typeof host === 'object') {
            for (let name in host) {
                if (host.hasOwnProperty(name) && name !== 'onReturn') {
                    this.append(name, host[name]);
                }
            }

            context = this.getContext();
            callback = host.onReturn;
        }
        if (this.hasFunction) BridgeContext.Add(this.key, this.callbacks);

        this.exec(content, code, context, callback);
    }
}

BridgeContext.Hosts = new Map();

module.exports = BridgeContext;