'use strict';
/* النسخة التجريبية: تشغيل خادم النظام بالكامل داخل المتصفح */
globalThis.process = globalThis.process || { env: {} };
globalThis.Buffer = require('./shims/buffer').Buffer;

const STORE_KEY = 'gold-demo-db-v1';
const DEMO_USER = { username: 'demo', password: 'demo1234' };
const realFetch = globalThis.fetch.bind(globalThis);
let app;
let db;
let cookie = '';
let saveTimer;

function loadSaved() {
  try {
    const b64 = localStorage.getItem(STORE_KEY);
    if (!b64) return null;
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  } catch { return null; }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const u = globalThis.__SQL_DB__.export();
      let bin = '';
      for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      localStorage.setItem(STORE_KEY, btoa(bin));
    } catch { /* التخزين غير متاح: تبقى البيانات في هذه الجلسة فقط */ }
  }, 300);
}

async function call(method, url, body) {
  const u = new URL(url, location.href);
  const req = {
    method, path: u.pathname.replace(/^.*?(\/api\/)/, '/api/'), url: u.pathname + u.search,
    query: Object.fromEntries(u.searchParams.entries()), body: body || {}, headers: { cookie }, ip: 'demo', secure: true, params: {},
  };
  const res = await app.handle(req);
  const sc = res.headers['set-cookie'];
  if (sc) { const pair = sc.split(';')[0]; cookie = /Max-Age=0/.test(sc) ? '' : pair; }
  if (method !== 'GET') save();
  return res;
}

function seed(acc, auth, setSettings) {
  const d = (off) => { const t = new Date(); t.setUTCDate(t.getUTCDate() + off); return t.toISOString().slice(0, 10); };
  const now = new Date();
  const first = `${now.toISOString().slice(0, 7)}-01`;
  const lastMonth = (day) => { const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day)); return t.toISOString().slice(0, 10); };
  const inMonth = (off) => { const x = d(off); return x < first ? first : x; };
  db.prepare("INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, 'admin')").run(DEMO_USER.username, 'مستخدم تجريبي', auth.hashPassword(DEMO_USER.password));
  setSettings(db, {
    company_name: 'مجوهرات الريان (تجريبي)', company_name_en: 'Al Rayan Jewelry (Demo)', vat_number: '310122393500003', cr_number: '1010000000',
    address_street: 'طريق الملك فهد', address_building: '1234', address_district: 'العليا', address_city: 'الرياض', address_postal: '12211',
    phone: '0110000000', gold_price_24: '420', default_making_per_gram: '25',
  });
  const open = lastMonth(1);
  acc.postJournal(db, { date: open, description: 'رأس المال المدفوع', lines: [{ account_code: '1102', debit: 150000 }, { account_code: '3101', credit: 150000 }] });
  acc.postJournal(db, { date: open, description: 'رصيد افتتاحي للصندوق', lines: [{ account_code: '1101', debit: 20000 }, { account_code: '3101', credit: 20000 }] });
  acc.openingStock(db, { date: open, karat: 21, weight: 1200, costPerGram: 330 });
  acc.openingStock(db, { date: open, karat: 18, weight: 600, costPerGram: 285 });
  acc.openingStock(db, { date: open, karat: 24, weight: 300, costPerGram: 395 });
  acc.openingStock(db, { date: open, karat: 22, weight: 200, costPerGram: 360 });
  const cust = db.prepare("INSERT INTO parties (kind, name, vat_number, phone, city) VALUES ('customer', ?, ?, ?, 'الرياض')");
  const c1 = Number(cust.run('شركة النخبة للهدايا', '300987654300003', '0551234567').lastInsertRowid);
  cust.run('نورة العتيبي', null, '0509876543');
  const sup = db.prepare("INSERT INTO parties (kind, name, vat_number, phone, city) VALUES ('supplier', ?, ?, ?, 'جدة')");
  const s1 = Number(sup.run('مصنع الذهب العربي', '311111111100003', '0122222222').lastInsertRowid);
  const sale = (date, lines, extra = {}) => acc.createInvoice(db, { type: 'sale', date, payment_method: 'cash', lines, ...extra });
  sale(lastMonth(5), [{ description: 'طقم عروس', karat: 21, weight: 62.4, price_per_gram: 352, making_per_gram: 40 }], { payment_method: 'card' });
  sale(lastMonth(12), [{ description: 'سبيكة 50 جم', karat: 24, weight: 50, price_per_gram: 405, category: 'investment' }], { payment_method: 'bank' });
  sale(lastMonth(20), [{ description: 'أساور', karat: 18, weight: 35.2, price_per_gram: 300, making_per_gram: 30 }]);
  acc.createInvoice(db, { type: 'purchase', date: lastMonth(15), party_id: s1, purchase_source: 'vat_supplier', payment_method: 'bank', lines: [{ description: 'مشغولات جديدة', karat: 21, weight: 120, price_per_gram: 345, making_per_gram: 18 }] });
  acc.createExpense(db, { date: lastMonth(28), account_code: '6102', description: 'إيجار المحل', amount: 8000, vat_amount: 1200, supplier_name: 'مؤسسة العقار', payment_method: 'bank' });
  acc.createExpense(db, { date: lastMonth(28), account_code: '6101', description: 'رواتب الموظفين', amount: 14000, payment_method: 'bank' });
  const inv1 = sale(inMonth(-3), [{ description: 'خاتم ألماس', karat: 18, weight: 6.8, making_per_gram: 60 }, { description: 'سلسلة', karat: 21, weight: 14.25 }]);
  sale(inMonth(-2), [{ description: 'هدايا شركات', karat: 21, weight: 45, making_per_gram: 20 }], { subtype: 'standard', party_id: c1, payment_method: 'credit' });
  sale(inMonth(-1), [{ description: 'جنيه ذهب', karat: 22, weight: 8, category: 'investment', making_per_gram: 0 }, { description: 'حلق', karat: 21, weight: 5.6 }], { payment_method: 'card' });
  acc.createInvoice(db, { type: 'purchase', date: inMonth(-1), party_name: 'عبدالله محمد', purchase_source: 'individual', payment_method: 'cash', lines: [{ description: 'ذهب كسر', karat: 21, weight: 32.5, price_per_gram: 335 }] });
  sale(inMonth(0), [{ description: 'دبلة', karat: 21, weight: 7.2 }]);
  sale(inMonth(0), [{ description: 'طقم أطفال', karat: 18, weight: 12.4, making_per_gram: 35 }], { payment_method: 'card' });
  acc.createInvoice(db, { type: 'sale_return', date: inMonth(-1), original_invoice_id: inv1.id, payment_method: 'cash', lines: [{ description: 'سلسلة (مرتجع)', karat: 21, weight: 14.25, price_per_gram: 367.5, making_per_gram: 25 }] });
  acc.createExpense(db, { date: inMonth(0), account_code: '6103', description: 'فاتورة الكهرباء', amount: 950, vat_amount: 142.5, supplier_name: 'الشركة السعودية للكهرباء', payment_method: 'bank' });
}

async function start(fresh) {
  const initSqlJs = require('sql.js/dist/sql-asm-memory-growth.js');
  const SQL = start.SQL || (start.SQL = await initSqlJs());
  const saved = fresh ? null : loadSaved();
  globalThis.__SQL_DB__ = saved ? new SQL.Database(saved) : new SQL.Database();
  const { openDb, setSettings } = require('../server/db');
  const auth = require('../server/auth');
  const acc = require('../server/accounting');
  const { createApp } = require('../server/index');
  db = openDb(':memory:');
  if (!db.prepare('SELECT COUNT(*) n FROM users').get().n) { seed(acc, auth, setSettings); save(); }
  app = app || createApp(db);
  cookie = '';
  await call('POST', '/api/auth/login', { ...DEMO_USER });
}

let ready = start(false).catch((e) => { console.error(e); throw e; });

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const u = new URL(url, location.href);
  if (!/\/api\//.test(u.pathname) || u.origin !== location.origin) return realFetch(input, init);
  await ready;
  const res = await call((init.method || 'GET').toUpperCase(), url, init.body ? JSON.parse(init.body) : undefined);
  return new Response(res.body, { status: res.statusCode, headers: { 'content-type': res.headers['content-type'] || 'application/json' } });
};

// لا توجد نوافذ تأكيد داخل الصفحة
globalThis.confirm = () => true;

document.addEventListener('click', async (e) => {
  const a = e.target.closest && e.target.closest('a[href*="/api/"]');
  if (!a) return;
  e.preventDefault();
  const res = await call('GET', a.getAttribute('href'));
  if (typeof globalThis.modal === 'function') {
    globalThis.modal(`<h3>ملف الفاتورة الإلكترونية (XML - UBL 2.1)</h3>
      <p class="muted">هذا الملف يُرسل لمنصة فاتورة. في النسخة الفعلية يُنزّل كملف.</p>
      <pre style="direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;font-size:12px;background:var(--th);padding:12px;border-radius:8px;max-height:60vh;overflow:auto"></pre>
      <div class="actions"><button class="btn secondary" onclick="closeModal()">إغلاق</button></div>`);
    document.querySelector('#modalBox pre').textContent = res.body.replace(/></g, '>\n<');
  }
}, true);

globalThis.resetDemo = async () => {
  try { localStorage.removeItem(STORE_KEY); } catch { /* */ }
  ready = start(true);
  await ready;
  location.hash = '#/dashboard';
  if (typeof globalThis.boot === 'function') globalThis.boot();
  if (typeof globalThis.toast === 'function') globalThis.toast('تمت إعادة البيانات التجريبية');
};
