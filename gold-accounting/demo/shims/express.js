'use strict';
// نسخة مصغرة من Express تعمل داخل المتصفح لتشغيل نفس واجهات الخادم
function compile(path) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { re, keys };
}

function express() {
  const layers = [];
  const app = {
    disable() {}, set() {},
    use(a, ...fns) {
      if (typeof a === 'string') fns.forEach((fn) => layers.push({ prefix: a, fn }));
      else [a, ...fns].forEach((fn) => layers.push({ fn }));
    },
    handle(req) {
      return new Promise((resolve) => {
        const res = {
          statusCode: 200, headers: {}, body: '',
          status(c) { this.statusCode = c; return this; },
          setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
          json(o) { this.headers['content-type'] = 'application/json'; this.body = JSON.stringify(o); resolve(this); },
          send(s) { if (!this.headers['content-type']) this.headers['content-type'] = 'text/plain'; this.body = String(s); resolve(this); },
          download() { this.status(400).json({ error: 'التنزيل غير متاح في النسخة التجريبية' }); },
        };
        let i = 0;
        const next = (err) => {
          while (i < layers.length) {
            const l = layers[i++];
            if (l.prefix && !req.path.startsWith(l.prefix)) continue;
            if (l.method && l.method !== req.method) continue;
            if (l.route) { const m = req.path.match(l.route.re); if (!m) continue; req.params = Object.fromEntries(l.route.keys.map((k, j) => [k, decodeURIComponent(m[j + 1])])); }
            const isErr = l.fn.length === 4;
            if (err ? !isErr : isErr) continue;
            try {
              const r = err ? l.fn(err, req, res, next) : l.fn(req, res, next);
              if (r && typeof r.catch === 'function') r.catch(next);
            } catch (e) { next(e); }
            return;
          }
          res.status(err ? 500 : 404).json({ error: err ? String(err.message) : 'غير موجود' });
        };
        next();
      });
    },
  };
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    app[m] = (path, ...fns) => { const route = compile(path); fns.forEach((fn) => layers.push({ method: m.toUpperCase(), route, fn })); };
  }
  return app;
}
express.json = () => (req, res, next) => next();
express.static = () => (req, res, next) => next();
module.exports = express;
