'use strict';
// يبني النسخة التجريبية كصفحة واحدة تعمل في المتصفح بدون خادم
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const out = process.argv[2] || path.join(__dirname, 'dist');
const pub = path.join(__dirname, '..', 'public');
const shim = (f) => path.join(__dirname, 'shims', f);

const result = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'entry.js')],
  bundle: true, minify: true, write: false, format: 'iife', platform: 'browser', target: 'es2020',
  alias: { 'better-sqlite3': shim('sqlite.js'), crypto: shim('crypto.js'), express: shim('express.js'), path: shim('empty.js'), fs: shim('empty.js'), os: shim('empty.js'), 'node:fs': shim('empty.js'), 'node:crypto': shim('empty.js'), 'node:path': shim('empty.js') },
  define: { 'require.main': 'undefined', __dirname: '"/app"', 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const bundle = safe(result.outputFiles[0].text);
const css = fs.readFileSync(path.join(pub, 'styles.css'), 'utf8');
const appJs = safe(fs.readFileSync(path.join(pub, 'app.js'), 'utf8'));
const body = fs.readFileSync(path.join(pub, 'index.html'), 'utf8').match(/<body>([\s\S]*?)<script/)[1];

const demoCss = `
.demo-bar { background: var(--gold-soft); color: var(--gold-ink); padding: 8px 16px; font-size: 13px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: center; border-bottom: 1px solid var(--line); }
.demo-bar code { background: var(--panel); padding: 1px 6px; border-radius: 4px; }
button[onclick="window.print()"], a[href="/api/backup"] { display: none !important; }
`;
const html = `<title>نظام محاسبة الذهب</title>
<meta name="description" content="نسخة تجريبية من نظام محاسبة محلات الذهب">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>${css}${demoCss}</style>
<div dir="rtl" lang="ar">
<div class="demo-bar">
  <b>نسخة تجريبية</b>
  <span>المستخدم <code>demo</code> وكلمة المرور <code>demo1234</code></span>
  <span>البيانات أمثلة وتُحفظ في هذا المتصفح فقط</span>
  <button class="btn secondary sm" onclick="resetDemo()">إعادة البيانات التجريبية</button>
</div>
${body}
</div>
<script>document.documentElement.dir='rtl';document.documentElement.lang='ar';</script>
<script>${bundle}</script>
<script>${appJs}</script>
`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'gold-demo.html'), html);
console.log('built', path.join(out, 'gold-demo.html'), (html.length / 1024 / 1024).toFixed(2) + 'MB');
