'use strict';
/* نظام محاسبة الذهب - الواجهة */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const grams = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 7) + '-01';
const KARATS = [24, 22, 21, 18];

const TYPE_LABEL = { sale: 'فاتورة مبيعات', purchase: 'فاتورة مشتريات', sale_return: 'مرتجع مبيعات', purchase_return: 'مرتجع مشتريات' };
const PAY_LABEL = { cash: 'نقداً', bank: 'تحويل بنكي', card: 'مدى / بطاقة', credit: 'آجل' };
const ROLE_LABEL = { admin: 'مدير النظام', accountant: 'محاسب', cashier: 'كاشير' };
const ZATCA_LABEL = { not_submitted: ['لم يُرسل', 'muted'], reported: ['تم الإبلاغ', 'ok'], cleared: ['معتمدة', 'ok'], rejected: ['مرفوضة', 'bad'], error: ['خطأ', 'bad'] };
const SOURCE_LABEL = { vat_supplier: 'مورد مسجل بالضريبة', individual: 'فرد (ذهب مستعمل/كسر)', zero_rated: 'ذهب استثماري (نسبة صفرية)' };

const state = { user: null, perms: [], settings: {}, accounts: [] };
const can = (p) => state.perms.includes('*') || state.perms.includes(p);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (res.status === 401 && !path.startsWith('/api/auth')) { boot(); throw new Error(data.error || 'انتهت الجلسة'); }
  if (!res.ok) throw new Error((data && data.error) || data.message || 'حدث خطأ');
  return data;
}

function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (bad ? ' bad' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), 3500);
}

function modal(html) {
  $('#modalBox').innerHTML = html;
  $('#modal').classList.remove('hidden');
  return $('#modalBox');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

const formData = (form) => Object.fromEntries(new FormData(form).entries());
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

// ---------------- الإقلاع والمصادقة ----------------

async function boot() {
  const st = await api('/api/auth/status');
  if (st.setupRequired) return renderSetup();
  if (!st.user) return renderLogin();
  state.user = st.user;
  state.perms = st.perms;
  state.settings = await api('/api/settings');
  $('#auth').classList.add('hidden');
  $('#shell').classList.remove('hidden');
  $('#meName').textContent = `${st.user.name} (${ROLE_LABEL[st.user.role]})`;
  $('#brandName').textContent = state.settings.company_name || 'محاسبة الذهب';
  renderNav();
  renderGoldPrice();
  route();
}

function renderSetup() {
  $('#shell').classList.add('hidden');
  const a = $('#auth');
  a.classList.remove('hidden');
  a.innerHTML = `<form class="card" id="setupForm">
    <h2>مرحباً بك في نظام محاسبة الذهب</h2>
    <p class="muted">أنشئ حساب مدير النظام للبدء.</p>
    <div class="grid">
      <label>اسم المنشأة<input name="company_name" required></label>
      <label>اسمك<input name="name" required></label>
      <label>اسم المستخدم<input name="username" required autocomplete="username"></label>
      <label>كلمة المرور (8 أحرف على الأقل)<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
      <button class="btn">إنشاء الحساب</button>
    </div></form>`;
  $('#setupForm').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/auth/setup', { method: 'POST', body: formData(e.target) });
    location.hash = '#/settings';
    boot();
  });
}

function renderLogin() {
  $('#shell').classList.add('hidden');
  const a = $('#auth');
  a.classList.remove('hidden');
  a.innerHTML = `<form class="card" id="loginForm">
    <h2><span class="coin">◆</span> تسجيل الدخول</h2>
    <div class="grid">
      <label>اسم المستخدم<input name="username" required autocomplete="username"></label>
      <label>كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn">دخول</button>
    </div></form>`;
  $('#loginForm').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/auth/login', { method: 'POST', body: formData(e.target) });
    boot();
  });
}

$('#logoutBtn').onclick = guard(async () => { await api('/api/auth/logout', { method: 'POST' }); boot(); });
$('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');

// ---------------- التنقل ----------------

const NAV = [
  ['الرئيسية', [['dashboard', 'لوحة التحكم', null]]],
  ['العمليات', [
    ['new/sale', 'فاتورة بيع', 'sales'],
    ['new/purchase', 'فاتورة شراء', 'purchases'],
    ['new/sale_return', 'مرتجع مبيعات', 'returns'],
    ['new/purchase_return', 'مرتجع مشتريات', 'purchases'],
    ['invoices', 'سجل الفواتير', null],
    ['expenses', 'المصروفات', 'expenses'],
  ]],
  ['البيانات', [
    ['inventory', 'مخزون الذهب', 'inventory'],
    ['parties', 'العملاء والموردون', 'parties'],
    ['journal', 'القيود اليومية', 'journal'],
    ['accounts', 'دليل الحسابات', 'journal'],
  ]],
  ['التقارير', [
    ['reports/monthly', 'التقرير الشهري', 'reports'],
    ['reports/income', 'القوائم المالية', 'reports'],
    ['reports/vat', 'الإقرار الضريبي', 'reports'],
    ['reports/zakat', 'تقدير الزكاة', 'reports'],
  ]],
  ['النظام', [
    ['settings', 'الإعدادات', 'settings'],
    ['users', 'المستخدمون', 'users'],
  ]],
];

function renderNav() {
  $('#nav').innerHTML = NAV.map(([g, items]) => {
    const vis = items.filter(([, , p]) => !p || can(p));
    if (!vis.length) return '';
    return `<div class="group">${g}</div>` + vis.map(([h, l]) => `<a href="#/${h}" data-h="${h}">${l}</a>`).join('');
  }).join('');
}

function renderGoldPrice() {
  const p = Number(state.settings.gold_price_24 || 0);
  $('#goldPrice').innerHTML = p
    ? KARATS.map((k) => `<span>عيار ${k}: <b>${money((p * k) / 24)}</b></span>`).join('')
    : '<span class="neg">حدّث سعر الذهب من لوحة التحكم</span>';
}

window.addEventListener('hashchange', route);

function route() {
  if (!state.user) return;
  const h = (location.hash || '#/dashboard').slice(2);
  const [page, ...rest] = h.split('/');
  $$('#nav a').forEach((a) => a.classList.toggle('active', h.startsWith(a.dataset.h)));
  $('#sidebar').classList.remove('open');
  const view = $('#view');
  view.innerHTML = '<p class="muted">جاري التحميل…</p>';
  const pages = {
    dashboard: pageDashboard, new: () => pageInvoiceForm(rest[0]), invoices: pageInvoices, invoice: () => pageInvoice(rest[0]),
    expenses: pageExpenses, inventory: pageInventory, parties: pageParties, journal: pageJournal, accounts: pageAccounts,
    reports: () => pageReports(rest[0]), settings: pageSettings, users: pageUsers,
  };
  (pages[page] || pageDashboard)().catch((e) => { view.innerHTML = `<div class="card neg">${esc(e.message)}</div>`; });
}

function title(t) { $('#pageTitle').textContent = t; document.title = `${t} - ${state.settings.company_name || 'محاسبة الذهب'}`; }

function rangeBar(onChange, { from = monthStart(), to = today(), extra = '' } = {}) {
  return `<form class="toolbar" id="rangeForm">
    <label>من<input type="date" name="from" value="${from}"></label>
    <label>إلى<input type="date" name="to" value="${to}"></label>
    ${extra}
    <button class="btn secondary">عرض</button>
    <button type="button" class="btn secondary" onclick="window.print()">طباعة</button>
  </form>`;
}

function bindRange(fn) {
  const f = $('#rangeForm');
  f.onsubmit = (e) => { e.preventDefault(); fn(formData(f)); };
  fn(formData(f));
}

// ---------------- لوحة التحكم ----------------

async function pageDashboard() {
  title('لوحة التحكم');
  const d = await api('/api/dashboard');
  const max = Math.max(1, ...d.trend.map((t) => t.sales));
  const inv = d.inventory;
  $('#view').innerHTML = `
    ${can('sales') ? `<form class="card toolbar" id="priceForm" style="align-items:end">
      <label>سعر جرام الذهب عيار 24 اليوم (ريال)<input name="gold_price_24" type="number" step="0.01" min="0" value="${esc(state.settings.gold_price_24)}"></label>
      <button class="btn">تحديث السعر</button>
      <span class="muted">تُحسب أسعار باقي الأعيرة تلقائياً.</span>
    </form>` : ''}
    <div class="grid kpis">
      <div class="kpi"><div class="label">مبيعات اليوم</div><div class="value">${money(d.today.total)}</div><div class="sub">${d.today.n} فاتورة</div></div>
      <div class="kpi"><div class="label">مبيعات الشهر</div><div class="value">${money(d.month.total)}</div><div class="sub">${d.month.n} فاتورة</div></div>
      ${d.month.grossProfit != null ? `<div class="kpi"><div class="label">مجمل ربح الشهر</div><div class="value">${money(d.month.grossProfit)}</div><div class="sub">صافي: ${money(d.month.netProfit)}</div></div>` : ''}
      <div class="kpi"><div class="label">الصندوق</div><div class="value">${money(d.cash)}</div>${d.bank != null ? `<div class="sub">البنك ومدى: ${money(d.bank)}</div>` : ''}</div>
      <div class="kpi"><div class="label">مخزون الذهب</div><div class="value">${grams(inv.totals.weight)} جم</div><div class="sub">ما يعادل ${grams(inv.totals.pure24)} جم عيار 24</div></div>
      ${d.vatPayable != null ? `<div class="kpi"><div class="label">صافي ضريبة مستحقة</div><div class="value">${money(d.vatPayable)}</div><div class="sub">ذمم عملاء ${money(d.receivables)} · موردين ${money(d.payables)}</div></div>` : ''}
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>المبيعات الشهرية</h3>
        ${d.trend.length ? `<div class="bar-chart" style="margin-bottom:24px">${d.trend.map((t) => `<div class="bar" title="${t.ym}: ${money(t.sales)}" style="height:${(t.sales / max) * 100}%"><span>${t.ym.slice(5)}</span></div>`).join('')}</div>` : '<p class="muted">لا توجد مبيعات بعد.</p>'}
      </div>
      <div class="card"><h3>المخزون حسب العيار</h3>
        <table><tr><th>العيار</th><th class="num">الوزن (جم)</th><th class="num">القيمة السوقية</th></tr>
        ${inv.rows.map((r) => `<tr><td>${r.karat}</td><td class="num">${grams(r.weight)}</td><td class="num">${money(r.marketValue)}</td></tr>`).join('')}</table>
      </div>
    </div>
    <div class="card"><h3>آخر الفواتير</h3>${invoiceTable(d.recent)}</div>`;
  const pf = $('#priceForm');
  if (pf) pf.onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/gold-price', { method: 'PUT', body: formData(pf) });
    state.settings = await api('/api/settings');
    renderGoldPrice();
    toast('تم تحديث سعر الذهب');
  });
}

function invoiceTable(rows) {
  if (!rows.length) return '<p class="muted">لا توجد فواتير.</p>';
  return `<div class="table-wrap"><table>
    <tr><th>الرقم</th><th>النوع</th><th>التاريخ</th><th>العميل/المورد</th><th class="num">الإجمالي</th>${rows[0].zatca_status !== undefined ? '<th>فاتورة</th>' : ''}</tr>
    ${rows.map((r) => `<tr class="clickable" onclick="location.hash='#/invoice/${r.id}'">
      <td>${esc(r.number)}</td><td>${TYPE_LABEL[r.type]}${r.subtype === 'standard' ? ' <span class="badge">ضريبية</span>' : ''}</td><td>${r.date}</td>
      <td>${esc(r.party_name || '—')}</td><td class="num">${money(r.total)}</td>
      ${r.zatca_status !== undefined ? `<td>${r.type.startsWith('sale') ? `<span class="badge ${ZATCA_LABEL[r.zatca_status][1]}">${ZATCA_LABEL[r.zatca_status][0]}</span>` : ''}</td>` : ''}
    </tr>`).join('')}</table></div>`;
}

// ---------------- نموذج الفاتورة ----------------

async function pageInvoiceForm(type) {
  if (!TYPE_LABEL[type]) type = 'sale';
  title(TYPE_LABEL[type]);
  const isSale = type.startsWith('sale');
  const isReturn = type.endsWith('return');
  const kind = isSale ? 'customer' : 'supplier';
  const parties = await api(`/api/parties?kind=${kind}`);
  const originals = isReturn ? await api(`/api/invoices?type=${isSale ? 'sale' : 'purchase'}&from=2000-01-01`) : [];
  const price24 = Number(state.settings.gold_price_24 || 0);
  const defMaking = state.settings.default_making_per_gram || 0;

  $('#view').innerHTML = `<form class="card" id="invForm">
    <div class="form">
      <label>التاريخ<input type="date" name="date" value="${today()}" required></label>
      ${isSale ? `<label>نوع الفاتورة<select name="subtype"><option value="simplified">مبسطة (للأفراد B2C)</option><option value="standard">ضريبية (للمنشآت B2B)</option></select></label>` : ''}
      ${!isSale ? `<label>مصدر الشراء<select name="purchase_source">${Object.entries(SOURCE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>` : ''}
      <label>${isSale ? 'العميل' : 'المورد'}<select name="party_id"><option value="">${isSale ? 'عميل نقدي' : '— اختر —'}</option>${parties.map((p) => `<option value="${p.id}">${esc(p.name)}${p.vat_number ? ' · ' + p.vat_number : ''}</option>`).join('')}</select></label>
      <label>الاسم (إن لم يكن مسجلاً)<input name="party_name"></label>
      <label>الرقم الضريبي للطرف الآخر<input name="party_vat" inputmode="numeric" maxlength="15"></label>
      <label>طريقة الدفع<select name="payment_method">${Object.entries(PAY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      ${isReturn ? `<label>الفاتورة الأصلية<select name="original_invoice_id"><option value="">—</option>${originals.map((o) => `<option value="${o.id}">${esc(o.number)} · ${o.date} · ${money(o.total)}</option>`).join('')}</select></label>` : ''}
    </div>
    ${!isSale ? '<div class="note">عند الشراء من الأفراد (ذهب مستعمل) لا تُحتسب ضريبة مدخلات. يُنصح بتسجيل البائع في قائمة الموردين مع رقم الهوية.</div>' : ''}
    <h3 style="margin-top:18px">البنود</h3>
    <div class="table-wrap"><table class="lines"><thead><tr>
      <th>الوصف</th><th>التصنيف</th><th>العيار</th><th>الوزن (جم)</th><th>سعر الجرام</th><th>المصنعية/جم</th><th class="num">الإجمالي قبل الضريبة</th><th></th>
    </tr></thead><tbody id="lines"></tbody></table></div>
    <div class="actions" style="margin-top:10px"><button type="button" class="btn secondary sm" id="addLine">+ إضافة بند</button></div>
    <div class="form" style="margin-top:14px">
      <label>الخصم (ريال)<input type="number" name="discount" step="0.01" min="0" value="0"></label>
      <label style="grid-column: span 2">ملاحظات<input name="notes"></label>
    </div>
    <div class="summary" id="summary"></div>
    <div class="actions" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="saveBtn">حفظ وإصدار</button></div>
  </form>`;

  const tbody = $('#lines');
  const addLine = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input name="description" placeholder="مثال: خاتم، سلسلة، سبيكة"></td>
      <td><select name="category"><option value="jewelry">مشغولات (15%)</option><option value="investment">ذهب استثماري (0%)</option></select></td>
      <td><select name="karat">${KARATS.map((k) => `<option ${k === 21 ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
      <td><input name="weight" type="number" step="0.001" min="0" required></td>
      <td><input name="price_per_gram" type="number" step="0.01" min="0" value="${price24 ? ((price24 * 21) / 24).toFixed(2) : ''}"></td>
      <td><input name="making_per_gram" type="number" step="0.01" min="0" value="${defMaking}"></td>
      <td class="num lt">0.00</td>
      <td><button type="button" class="btn secondary sm rm">✕</button></td>`;
    tbody.appendChild(tr);
    const karat = $('[name=karat]', tr);
    const price = $('[name=price_per_gram]', tr);
    const cat = $('[name=category]', tr);
    karat.onchange = () => { if (price24) price.value = ((price24 * karat.value) / 24).toFixed(2); recalc(); };
    $('.rm', tr).onclick = () => { if (tbody.children.length > 1) { tr.remove(); recalc(); } };
  };
  const readLines = () => $$('tr', tbody).map((tr) => Object.fromEntries($$('input,select', tr).map((i) => [i.name, i.value])));
  let timer;
  const recalc = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!$('#invForm')) return;
      const f = formData($('#invForm'));
      const lines = readLines().filter((l) => Number(l.weight) > 0);
      if (!lines.length) { $('#summary').innerHTML = ''; return; }
      try {
        const c = await api('/api/invoices/preview', { method: 'POST', body: { type, lines, discount: f.discount, purchase_source: f.purchase_source } });
        let i = 0;
        $$('tr', tbody).forEach((tr) => { if (Number($('[name=weight]', tr).value) > 0) $('.lt', tr).textContent = money(c.lines[i++].line_subtotal); });
        $('#summary').innerHTML = `
          <span>قيمة الذهب</span><span>${money(c.goldValue)}</span>
          <span>المصنعية</span><span>${money(c.makingValue)}</span>
          <span>الخصم</span><span>${money(c.discount)}</span>
          <span>الإجمالي الخاضع للضريبة</span><span>${money(c.taxable)}</span>
          <span>ضريبة القيمة المضافة</span><span>${money(c.vat)}</span>
          <span class="grand">الإجمالي</span><span class="grand">${money(c.total)} ر.س</span>`;
      } catch (e) { $('#summary').innerHTML = `<span class="neg" style="grid-column:span 2">${esc(e.message)}</span>`; }
    }, 250);
  };
  addLine();
  $('#addLine').onclick = addLine;
  $('#invForm').addEventListener('input', recalc);
  $('#invForm').addEventListener('change', recalc);
  $('#invForm').onsubmit = guard(async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const body = { ...f, type, lines: readLines().filter((l) => Number(l.weight) > 0) };
    for (const k of ['party_id', 'original_invoice_id']) body[k] = body[k] ? Number(body[k]) : null;
    $('#saveBtn').disabled = true;
    try {
      const inv = await api('/api/invoices', { method: 'POST', body });
      toast(`تم إصدار ${inv.number}`);
      location.hash = `#/invoice/${inv.id}`;
    } finally { $('#saveBtn').disabled = false; }
  });
}

// ---------------- الفواتير ----------------

async function pageInvoices() {
  title('سجل الفواتير');
  $('#view').innerHTML = `<div class="card">${rangeBar(null, { extra: `
    <label>النوع<select name="type"><option value="">الكل</option>${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label>بحث<input name="q" placeholder="رقم الفاتورة أو الاسم"></label>` })}<div id="list"></div></div>`;
  bindRange(guard(async (f) => {
    const rows = await api('/api/invoices?' + new URLSearchParams(f));
    const tot = rows.reduce((s, r) => s + (r.type.endsWith('return') ? -r.total : r.total), 0);
    $('#list').innerHTML = invoiceTable(rows) + (rows.length ? `<p class="muted">${rows.length} فاتورة · صافي ${money(tot)}</p>` : '');
  }));
}

async function pageInvoice(id) {
  const inv = await api(`/api/invoices/${id}`);
  title(`${TYPE_LABEL[inv.type]} ${inv.number}`);
  const s = inv.seller;
  const docTitle = inv.type === 'sale'
    ? (inv.subtype === 'standard' ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة')
    : inv.type === 'sale_return' ? 'إشعار دائن' : TYPE_LABEL[inv.type];
  const z = ZATCA_LABEL[inv.zatca_status];
  $('#view').innerHTML = `
    <div class="toolbar no-print">
      <button class="btn" onclick="window.print()">طباعة</button>
      ${inv.icv && can('zatca') ? `<a class="btn secondary" href="/api/invoices/${inv.id}/xml">تنزيل XML</a>
        <button class="btn secondary" id="submitZatca">إرسال لمنصة فاتورة</button>
        <span class="badge ${z[1]}">${z[0]}</span>` : ''}
      ${inv.type === 'sale' && can('returns') ? `<a class="btn secondary" href="#/new/sale_return">إنشاء مرتجع</a>` : ''}
    </div>
    <div class="invoice-doc">
      <div class="head">
        <div>
          <h2>${esc(s.name)}</h2>
          <div class="muted">${esc(s.name_en || '')}</div>
          <div>الرقم الضريبي: ${esc(s.vat_number || '—')}</div>
          <div>السجل التجاري: ${esc(s.cr_number || '—')}</div>
          <div class="muted">${esc(s.address)} ${s.phone ? '· ' + esc(s.phone) : ''}</div>
        </div>
        <div style="text-align:center">
          <h2>${docTitle}</h2>
          ${inv.qr_image ? `<div class="qr"><img src="${inv.qr_image}" alt="رمز QR"></div>` : ''}
        </div>
      </div>
      <div class="meta">
        <div>رقم الفاتورة: <b>${esc(inv.number)}</b></div>
        <div>التاريخ: ${inv.date} ${esc(String(inv.created_at).slice(11, 16))}</div>
        <div>طريقة الدفع: ${PAY_LABEL[inv.payment_method]}</div>
        ${inv.original_number ? `<div>عن الفاتورة: ${esc(inv.original_number)}</div>` : ''}
        <div>${inv.type.startsWith('sale') ? 'العميل' : 'المورد'}: ${esc(inv.party_name || 'عميل نقدي')}</div>
        ${inv.party_vat ? `<div>الرقم الضريبي للعميل: ${esc(inv.party_vat)}</div>` : ''}
        ${inv.purchase_source ? `<div>مصدر الشراء: ${SOURCE_LABEL[inv.purchase_source]}</div>` : ''}
      </div>
      <div class="table-wrap"><table>
        <tr><th>#</th><th>الوصف</th><th>العيار</th><th class="num">الوزن</th><th class="num">سعر الجرام</th><th class="num">المصنعية</th><th class="num">المبلغ</th><th class="num">الضريبة</th><th class="num">الإجمالي</th></tr>
        ${inv.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.description)}${l.category === 'investment' ? ' <span class="badge">استثماري</span>' : ''}</td><td>${l.karat}</td>
          <td class="num">${grams(l.weight)}</td><td class="num">${money(l.price_per_gram)}</td><td class="num">${money(l.making_value)}</td>
          <td class="num">${money(l.line_subtotal)}</td><td class="num">${money(l.vat_amount)} <small class="muted">(${l.vat_rate}%)</small></td><td class="num">${money(l.line_total)}</td></tr>`).join('')}
      </table></div>
      <div class="summary">
        <span>الإجمالي قبل الخصم</span><span>${money(inv.subtotal)}</span>
        <span>الخصم</span><span>${money(inv.discount)}</span>
        <span>الإجمالي الخاضع للضريبة</span><span>${money(inv.taxable_amount)}</span>
        <span>ضريبة القيمة المضافة</span><span>${money(inv.vat_amount)}</span>
        <span class="grand">الإجمالي شامل الضريبة</span><span class="grand">${money(inv.total)} ر.س</span>
      </div>
      ${inv.notes ? `<p class="muted">ملاحظات: ${esc(inv.notes)}</p>` : ''}
      ${inv.uuid && inv.icv ? `<p class="muted" style="font-size:11px;direction:ltr;text-align:left">UUID: ${esc(inv.uuid)} · ICV: ${inv.icv}</p>` : ''}
    </div>`;
  const sb = $('#submitZatca');
  if (sb) sb.onclick = guard(async () => {
    sb.disabled = true;
    try {
      const r = await fetch(`/api/invoices/${inv.id}/submit`, { method: 'POST' }).then((x) => x.json());
      toast(r.message || (r.ok ? 'تم الإرسال بنجاح' : `رفض: ${JSON.stringify(r.data || r.error)}`), !r.ok);
      if (r.status !== 'not_configured') pageInvoice(id);
    } finally { sb.disabled = false; }
  });
}

// ---------------- المصروفات ----------------

async function pageExpenses() {
  title('المصروفات');
  const accounts = (await api('/api/accounts')).filter((a) => a.type === 'expense' && !['5101', '6201'].includes(a.code));
  $('#view').innerHTML = `
    <form class="card" id="expForm"><h3>تسجيل مصروف</h3><div class="form">
      <label>التاريخ<input type="date" name="date" value="${today()}"></label>
      <label>الحساب<select name="account_code">${accounts.map((a) => `<option value="${a.code}">${esc(a.name)}</option>`).join('')}</select></label>
      <label>الوصف<input name="description" required></label>
      <label>المبلغ قبل الضريبة<input type="number" name="amount" step="0.01" min="0" required></label>
      <label>ضريبة المدخلات<input type="number" name="vat_amount" step="0.01" min="0" value="0"></label>
      <label>المورد<input name="supplier_name"></label>
      <label>الرقم الضريبي للمورد<input name="supplier_vat" maxlength="15"></label>
      <label>طريقة الدفع<select name="payment_method"><option value="cash">نقداً</option><option value="bank">بنك</option><option value="card">بطاقة</option><option value="credit">مستحق (لم يُدفع)</option></select></label>
    </div><div class="actions" style="margin-top:12px"><button class="btn">حفظ</button>
      <button type="button" class="btn secondary" id="vat15">احسب ضريبة 15%</button></div></form>
    <div class="card">${rangeBar()}<div id="list"></div></div>`;
  $('#vat15').onclick = () => { const f = $('#expForm'); f.vat_amount.value = (Number(f.amount.value || 0) * 0.15).toFixed(2); };
  const load = guard(async (f) => {
    const rows = await api('/api/expenses?' + new URLSearchParams(f));
    const tot = rows.reduce((s, r) => s + r.total, 0);
    $('#list').innerHTML = rows.length ? `<div class="table-wrap"><table>
      <tr><th>التاريخ</th><th>الحساب</th><th>الوصف</th><th>المورد</th><th class="num">المبلغ</th><th class="num">الضريبة</th><th class="num">الإجمالي</th>${can('users') ? '<th></th>' : ''}</tr>
      ${rows.map((r) => `<tr><td>${r.date}</td><td>${esc(r.account_name)}</td><td>${esc(r.description)}</td><td>${esc(r.supplier_name || '')}</td>
        <td class="num">${money(r.amount)}</td><td class="num">${money(r.vat_amount)}</td><td class="num">${money(r.total)}</td>
        ${can('users') ? `<td><button class="btn secondary sm" data-del="${r.id}">حذف</button></td>` : ''}</tr>`).join('')}
      <tr class="total"><td colspan="6">الإجمالي</td><td class="num">${money(tot)}</td>${can('users') ? '<td></td>' : ''}</tr></table></div>` : '<p class="muted">لا توجد مصروفات في الفترة.</p>';
    $$('[data-del]').forEach((b) => b.onclick = guard(async () => {
      if (!confirm('حذف المصروف وقيده؟')) return;
      await api(`/api/expenses/${b.dataset.del}`, { method: 'DELETE' });
      load(formData($('#rangeForm')));
    }));
  });
  bindRange(load);
  $('#expForm').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/expenses', { method: 'POST', body: formData(e.target) });
    toast('تم تسجيل المصروف');
    e.target.reset();
    e.target.date.value = today();
    load(formData($('#rangeForm')));
  });
}

// ---------------- المخزون ----------------

async function pageInventory() {
  title('مخزون الذهب');
  const inv = await api('/api/inventory');
  $('#view').innerHTML = `
    <div class="card"><h3>الأرصدة حسب العيار</h3>
      <p class="muted">سعر عيار 24 المعتمد: ${money(inv.price24)} ريال/جم</p>
      <div class="table-wrap"><table>
        <tr><th>العيار</th><th class="num">الوزن (جم)</th><th class="num">المعادل بعيار 24</th><th class="num">متوسط التكلفة/جم</th><th class="num">التكلفة</th><th class="num">السعر السوقي/جم</th><th class="num">القيمة السوقية</th></tr>
        ${inv.rows.map((r) => `<tr><td>${r.karat}</td><td class="num">${grams(r.weight)}</td><td class="num">${grams(r.pure24)}</td><td class="num">${money(r.avgCost)}</td>
          <td class="num">${money(r.cost)}</td><td class="num">${money(r.marketPrice)}</td><td class="num">${money(r.marketValue)}</td></tr>`).join('')}
        <tr class="total"><td>الإجمالي</td><td class="num">${grams(inv.totals.weight)}</td><td class="num">${grams(inv.totals.pure24)}</td><td></td>
          <td class="num">${money(inv.totals.cost)}</td><td></td><td class="num">${money(inv.totals.marketValue)}</td></tr>
      </table></div>
      <p>أرباح/خسائر غير محققة (فرق السعر السوقي عن التكلفة): <b class="${inv.totals.unrealizedGain >= 0 ? 'pos' : 'neg'}">${money(inv.totals.unrealizedGain)}</b></p>
    </div>
    ${can('journal') ? `<form class="card" id="openForm"><h3>رصيد افتتاحي للمخزون</h3>
      <p class="muted">لإدخال الذهب الموجود لديك عند بدء استخدام النظام (يُسجل مقابل رأس المال).</p>
      <div class="form">
        <label>التاريخ<input type="date" name="date" value="${today()}"></label>
        <label>العيار<select name="karat">${KARATS.map((k) => `<option>${k}</option>`).join('')}</select></label>
        <label>الوزن (جم)<input type="number" name="weight" step="0.001" min="0" required></label>
        <label>تكلفة الجرام<input type="number" name="cost_per_gram" step="0.01" min="0" required></label>
      </div><div class="actions" style="margin-top:12px"><button class="btn">إضافة</button></div></form>` : ''}
    <div class="card"><h3>حركة المخزون</h3>${rangeBar(null, { extra: `<label>العيار<select name="karat"><option value="">الكل</option>${KARATS.map((k) => `<option>${k}</option>`).join('')}</select></label>` })}<div id="moves"></div></div>`;
  const of = $('#openForm');
  if (of) of.onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/inventory/opening', { method: 'POST', body: formData(of) });
    toast('تمت إضافة الرصيد الافتتاحي');
    pageInventory();
  });
  const MOVE = { sale: 'بيع', purchase: 'شراء', sale_return: 'مرتجع مبيعات', purchase_return: 'مرتجع مشتريات', opening_stock: 'رصيد افتتاحي' };
  bindRange(guard(async (f) => {
    const rows = await api('/api/inventory/moves?' + new URLSearchParams(f));
    $('#moves').innerHTML = rows.length ? `<div class="table-wrap"><table>
      <tr><th>التاريخ</th><th>العيار</th><th>الحركة</th><th>المرجع</th><th class="num">وارد (جم)</th><th class="num">صادر (جم)</th><th class="num">التكلفة</th></tr>
      ${rows.map((r) => `<tr><td>${r.date}</td><td>${r.karat}</td><td>${MOVE[r.ref_type] || r.ref_type}</td><td>${esc(r.note || '')}</td>
        <td class="num">${r.weight > 0 ? grams(r.weight) : ''}</td><td class="num">${r.weight < 0 ? grams(-r.weight) : ''}</td><td class="num">${money(Math.abs(r.cost))}</td></tr>`).join('')}</table></div>` : '<p class="muted">لا توجد حركات.</p>';
  }));
}

// ---------------- العملاء والموردون ----------------

async function pageParties() {
  title('العملاء والموردون');
  $('#view').innerHTML = `
    <div class="tabs"><a href="#" data-k="customer" class="active">العملاء</a><a href="#" data-k="supplier">الموردون</a></div>
    <div class="card"><div class="toolbar"><label>بحث<input id="pq"></label><button class="btn" id="addParty">+ إضافة</button></div><div id="plist"></div></div>`;
  let kind = 'customer';
  const load = guard(async () => {
    const rows = await api(`/api/parties?kind=${kind}&q=${encodeURIComponent($('#pq').value)}`);
    $('#plist').innerHTML = rows.length ? `<div class="table-wrap"><table>
      <tr><th>الاسم</th><th>الجوال</th><th>الرقم الضريبي</th><th>رقم الهوية/السجل</th><th class="num">عدد الفواتير</th><th class="num">الرصيد الآجل</th><th></th></tr>
      ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.phone || '')}</td><td>${esc(r.vat_number || '')}</td><td>${esc(r.id_number || r.cr_number || '')}</td>
        <td class="num">${r.invoices_count}</td><td class="num">${money(r.credit_balance)}</td><td><button class="btn secondary sm" data-edit='${esc(JSON.stringify(r))}'>تعديل</button></td></tr>`).join('')}</table></div>` : '<p class="muted">لا توجد سجلات.</p>';
    $$('[data-edit]').forEach((b) => b.onclick = () => partyForm(JSON.parse(b.dataset.edit)));
  });
  const partyForm = (p = {}) => {
    const box = modal(`<form id="pf"><h3>${p.id ? 'تعديل' : 'إضافة'} ${kind === 'customer' ? 'عميل' : 'مورد'}</h3><div class="form">
      <label>الاسم<input name="name" required value="${esc(p.name || '')}"></label>
      <label>الجوال<input name="phone" value="${esc(p.phone || '')}"></label>
      <label>الرقم الضريبي<input name="vat_number" maxlength="15" value="${esc(p.vat_number || '')}"></label>
      <label>السجل التجاري<input name="cr_number" value="${esc(p.cr_number || '')}"></label>
      <label>رقم الهوية<input name="id_number" value="${esc(p.id_number || '')}"></label>
      <label>المدينة<input name="city" value="${esc(p.city || '')}"></label>
      <label style="grid-column:1/-1">العنوان<input name="address" value="${esc(p.address || '')}"></label>
    </div><div class="actions" style="margin-top:14px"><button class="btn">حفظ</button><button type="button" class="btn secondary" onclick="closeModal()">إلغاء</button></div></form>`);
    $('#pf', box).onsubmit = guard(async (e) => {
      e.preventDefault();
      const body = { ...formData(e.target), kind };
      if (p.id) await api(`/api/parties/${p.id}`, { method: 'PUT', body });
      else await api('/api/parties', { method: 'POST', body });
      closeModal();
      load();
    });
  };
  $$('.tabs a').forEach((a) => a.onclick = (e) => { e.preventDefault(); kind = a.dataset.k; $$('.tabs a').forEach((x) => x.classList.toggle('active', x === a)); load(); });
  $('#pq').oninput = load;
  $('#addParty').onclick = () => partyForm();
  load();
}

// ---------------- القيود ----------------

async function loadAccounts() { state.accounts = await api('/api/accounts'); return state.accounts; }
const accOptions = (sel) => state.accounts.map((a) => `<option value="${a.code}" ${a.code === sel ? 'selected' : ''}>${a.code} - ${esc(a.name)}</option>`).join('');

async function pageJournal() {
  title('القيود اليومية');
  await loadAccounts();
  $('#view').innerHTML = `
    <div class="toolbar"><button class="btn" id="newEntry">+ قيد يدوي</button></div>
    <div class="card">${rangeBar()}<div id="jlist"></div></div>`;
  const load = guard(async (f) => {
    const rows = await api('/api/journal?' + new URLSearchParams(f));
    $('#jlist').innerHTML = rows.length ? rows.map((e) => `<div style="margin-bottom:14px">
      <div class="actions" style="justify-content:space-between"><div><b>#${e.id}</b> · ${e.date} · ${esc(e.description)} ${e.ref_type !== 'manual' ? '<span class="badge muted">آلي</span>' : ''}</div>
      ${e.ref_type === 'manual' && can('users') ? `<button class="btn secondary sm" data-del="${e.id}">حذف</button>` : ''}</div>
      <table><tr><th>الحساب</th><th class="num">مدين</th><th class="num">دائن</th></tr>
      ${e.lines.map((l) => `<tr><td>${l.account_code} - ${esc(l.account_name)}</td><td class="num">${l.debit ? money(l.debit) : ''}</td><td class="num">${l.credit ? money(l.credit) : ''}</td></tr>`).join('')}</table></div>`).join('') : '<p class="muted">لا توجد قيود.</p>';
    $$('[data-del]').forEach((b) => b.onclick = guard(async () => {
      if (!confirm('حذف القيد؟')) return;
      await api(`/api/journal/${b.dataset.del}`, { method: 'DELETE' });
      load(formData($('#rangeForm')));
    }));
  });
  bindRange(load);
  $('#newEntry').onclick = () => {
    const box = modal(`<form id="jf"><h3>قيد يدوي</h3><div class="form">
      <label>التاريخ<input type="date" name="date" value="${today()}"></label>
      <label style="grid-column:span 2">البيان<input name="description" required></label></div>
      <table class="lines" style="margin-top:12px"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead><tbody id="jl"></tbody></table>
      <div class="actions" style="margin-top:8px"><button type="button" class="btn secondary sm" id="jadd">+ سطر</button><span id="jbal" class="muted"></span></div>
      <div class="note">حركات مخزون الذهب تتم عبر الفواتير أو الرصيد الافتتاحي فقط.</div>
      <div class="actions"><button class="btn">حفظ القيد</button><button type="button" class="btn secondary" onclick="closeModal()">إلغاء</button></div></form>`);
    const add = () => { const tr = document.createElement('tr'); tr.innerHTML = `<td><select name="account_code">${accOptions()}</select></td><td><input type="number" step="0.01" min="0" name="debit"></td><td><input type="number" step="0.01" min="0" name="credit"></td>`; $('#jl', box).appendChild(tr); };
    add(); add();
    $('#jadd', box).onclick = add;
    const rows = () => $$('#jl tr', box).map((tr) => Object.fromEntries($$('input,select', tr).map((i) => [i.name, i.value])));
    box.oninput = () => { const r = rows(); const d = r.reduce((s, x) => s + Number(x.debit || 0), 0); const c = r.reduce((s, x) => s + Number(x.credit || 0), 0); $('#jbal', box).innerHTML = `مدين ${money(d)} · دائن ${money(c)} ${Math.abs(d - c) < 0.005 ? '<span class="pos">متوازن</span>' : '<span class="neg">غير متوازن</span>'}`; };
    $('#jf', box).onsubmit = guard(async (e) => {
      e.preventDefault();
      await api('/api/journal', { method: 'POST', body: { ...formData(e.target), lines: rows() } });
      closeModal();
      toast('تم حفظ القيد');
      load(formData($('#rangeForm')));
    });
  };
}

async function pageAccounts() {
  title('دليل الحسابات');
  const TL = { asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' };
  const rows = await loadAccounts();
  $('#view').innerHTML = `
    <form class="card" id="accForm"><h3>إضافة حساب</h3><div class="form">
      <label>الرمز<input name="code" required pattern="\\d{3,6}"></label>
      <label>الاسم<input name="name" required></label>
      <label>النوع<select name="type">${Object.entries(TL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>متداول؟<select name="current"><option value="1">نعم</option><option value="">لا</option></select></label>
    </div><div class="actions" style="margin-top:12px"><button class="btn">إضافة</button></div></form>
    <div class="card"><div class="table-wrap"><table>
      <tr><th>الرمز</th><th>الاسم</th><th>النوع</th><th class="num">الرصيد</th><th></th></tr>
      ${rows.map((a) => `<tr><td>${a.code}</td><td>${esc(a.name)}</td><td>${TL[a.type]}</td><td class="num">${money(a.balance)}</td>
        <td><a href="#/reports/ledger?code=${a.code}">كشف حساب</a></td></tr>`).join('')}</table></div></div>`;
  $('#accForm').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/accounts', { method: 'POST', body: formData(e.target) });
    toast('تمت إضافة الحساب');
    pageAccounts();
  });
}

// ---------------- التقارير ----------------

const REPORT_TABS = [
  ['monthly', 'التقرير الشهري'], ['income', 'قائمة الدخل'], ['balance', 'المركز المالي'], ['cashflow', 'التدفقات النقدية'],
  ['trial', 'ميزان المراجعة'], ['ledger', 'كشف حساب'], ['vat', 'الإقرار الضريبي'], ['zakat', 'تقدير الزكاة'],
];

async function pageReports(sub = 'monthly') {
  const [name, qs] = String(sub).split('?');
  const params = new URLSearchParams(qs || '');
  const tabs = `<div class="tabs">${REPORT_TABS.map(([k, l]) => `<a href="#/reports/${k}" class="${k === name ? 'active' : ''}">${l}</a>`).join('')}</div>`;
  const fn = { monthly: rMonthly, income: rIncome, balance: rBalance, cashflow: rCashFlow, trial: rTrial, ledger: rLedger, vat: rVat, zakat: rZakat }[name] || rMonthly;
  title(REPORT_TABS.find((t) => t[0] === name)?.[1] || 'التقارير');
  $('#view').innerHTML = tabs + '<div id="rep"></div>';
  await fn($('#rep'), params);
}

const reportHeader = (t, sub) => `<div style="text-align:center;margin-bottom:12px"><h2 style="margin:0">${esc(state.settings.company_name)}</h2>
  <div>${t}</div><div class="muted">${sub}</div>${state.settings.vat_number ? `<div class="muted">الرقم الضريبي: ${esc(state.settings.vat_number)}</div>` : ''}</div>`;

async function rMonthly(el) {
  const now = new Date();
  el.innerHTML = `<div class="card"><form class="toolbar" id="mf">
    <label>السنة<input type="number" name="year" value="${now.getFullYear()}" style="width:100px"></label>
    <label>الشهر<select name="month">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i === now.getMonth() ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
    <button class="btn secondary">عرض</button><button type="button" class="btn secondary" onclick="window.print()">طباعة</button></form><div id="mout"></div></div>`;
  const load = guard(async () => {
    const r = await api('/api/reports/monthly?' + new URLSearchParams(formData($('#mf'))));
    const i = r.income;
    $('#mout').innerHTML = reportHeader('التقرير الشهري', `${r.from} إلى ${r.to}`) + `
      <div class="grid kpis">
        <div class="kpi"><div class="label">صافي المبيعات</div><div class="value">${money(i.netSales)}</div><div class="sub">${r.sales.n} فاتورة · متوسط ${money(r.avgInvoice)}</div></div>
        <div class="kpi"><div class="label">مجمل الربح</div><div class="value">${money(i.grossProfit)}</div><div class="sub">هامش ${i.grossMargin}%</div></div>
        <div class="kpi"><div class="label">المصروفات</div><div class="value">${money(i.expensesTotal)}</div></div>
        <div class="kpi"><div class="label">صافي الربح</div><div class="value ${i.netProfit >= 0 ? 'pos' : 'neg'}">${money(i.netProfit)}</div></div>
        <div class="kpi"><div class="label">المشتريات</div><div class="value">${money(r.purchases.total)}</div><div class="sub">${r.purchases.n} فاتورة</div></div>
        <div class="kpi"><div class="label">الضريبة المستحقة</div><div class="value">${money(r.vatDue)}</div></div>
      </div>
      <div class="grid cols-2">
        <div><h3>حركة الذهب بالوزن (جم)</h3><table><tr><th>العيار</th><th class="num">مباع</th><th class="num">مرتجع</th><th class="num">مشترى</th><th class="num">المخزون الحالي</th></tr>
          ${r.byKarat.map((k) => `<tr><td>${k.karat}</td><td class="num">${grams(k.sold)}</td><td class="num">${grams(k.returned)}</td><td class="num">${grams(k.purchased)}</td><td class="num">${grams(r.inventory.rows.find((x) => x.karat === k.karat).weight)}</td></tr>`).join('')}</table></div>
        <div><h3>المبيعات حسب طريقة الدفع</h3><table><tr><th>الطريقة</th><th class="num">العدد</th><th class="num">المبلغ</th></tr>
          ${r.byPayment.map((p) => `<tr><td>${PAY_LABEL[p.payment_method]}</td><td class="num">${p.n}</td><td class="num">${money(p.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">—</td></tr>'}</table>
          <h3>أفضل العملاء</h3><table>${r.topCustomers.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.n}</td><td class="num">${money(c.total)}</td></tr>`).join('') || '<tr><td class="muted">—</td></tr>'}</table></div>
        <div><h3>المصروفات حسب البند</h3><table>${r.expenses.map((e) => `<tr><td>${esc(e.name)}</td><td class="num">${money(e.amount)}</td></tr>`).join('') || '<tr><td class="muted">لا توجد مصروفات</td></tr>'}</table></div>
        <div><h3>الحركة اليومية</h3><div class="table-wrap"><table><tr><th>اليوم</th><th class="num">الفواتير</th><th class="num">المبيعات</th><th class="num">المشتريات</th></tr>
          ${r.daily.map((d) => `<tr><td>${d.date}</td><td class="num">${d.n}</td><td class="num">${money(d.sales)}</td><td class="num">${money(d.purchases)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</table></div></div>
      </div>`;
  });
  $('#mf').onsubmit = (e) => { e.preventDefault(); load(); };
  load();
}

const stmtRows = (rows) => rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${money(r.amount)}</td></tr>`).join('');

async function rIncome(el) {
  el.innerHTML = `<div class="card statement">${rangeBar(null, { from: today().slice(0, 4) + '-01-01' })}<div id="out"></div></div>`;
  bindRange(guard(async (f) => {
    const r = await api('/api/reports/income-statement?' + new URLSearchParams(f));
    $('#out').innerHTML = reportHeader('قائمة الدخل', `للفترة من ${r.from} إلى ${r.to}`) + `<table>
      <tr><td>مبيعات الذهب</td><td class="num">${money(r.salesGold)}</td></tr>
      <tr><td>إيرادات المصنعية</td><td class="num">${money(r.making)}</td></tr>
      <tr><td>يُطرح: مردودات المبيعات</td><td class="num">(${money(r.returns)})</td></tr>
      <tr class="total"><td>صافي المبيعات</td><td class="num">${money(r.netSales)}</td></tr>
      <tr><td>يُطرح: تكلفة الذهب المباع</td><td class="num">(${money(r.cogs)})</td></tr>
      <tr class="total"><td>مجمل الربح (هامش ${r.grossMargin}%)</td><td class="num">${money(r.grossProfit)}</td></tr>
      ${r.otherRevenue.length ? `<tr><td colspan="2"><b>إيرادات أخرى</b></td></tr>${stmtRows(r.otherRevenue)}` : ''}
      <tr><td colspan="2"><b>المصروفات التشغيلية</b></td></tr>${stmtRows(r.expenses)}
      <tr class="total"><td>إجمالي المصروفات</td><td class="num">(${money(r.expensesTotal)})</td></tr>
      <tr class="total"><td>الربح التشغيلي</td><td class="num">${money(r.operatingProfit)}</td></tr>
      <tr><td>الزكاة</td><td class="num">(${money(r.zakat)})</td></tr>
      <tr class="total"><td>صافي الربح (الخسارة)</td><td class="num ${r.netProfit >= 0 ? 'pos' : 'neg'}">${money(r.netProfit)}</td></tr></table>`;
  }));
}

async function rBalance(el) {
  el.innerHTML = `<div class="card statement"><form class="toolbar" id="bf"><label>كما في<input type="date" name="asOf" value="${today()}"></label>
    <button class="btn secondary">عرض</button><button type="button" class="btn secondary" onclick="window.print()">طباعة</button></form><div id="out"></div></div>`;
  const load = guard(async () => {
    const r = await api('/api/reports/balance-sheet?' + new URLSearchParams(formData($('#bf'))));
    $('#out').innerHTML = reportHeader('قائمة المركز المالي', `كما في ${r.asOf}`) + `<table>
      <tr><td colspan="2"><b>الأصول المتداولة</b></td></tr>${stmtRows(r.currentAssets)}
      <tr class="total"><td>إجمالي الأصول المتداولة</td><td class="num">${money(r.totalCurrentAssets)}</td></tr>
      <tr><td colspan="2"><b>الأصول غير المتداولة</b></td></tr>${stmtRows(r.fixedAssets)}
      <tr class="total"><td>إجمالي الأصول غير المتداولة</td><td class="num">${money(r.totalFixedAssets)}</td></tr>
      <tr class="total"><td>إجمالي الأصول</td><td class="num">${money(r.totalAssets)}</td></tr>
      <tr><td colspan="2"><b>الخصوم المتداولة</b></td></tr>${stmtRows(r.currentLiabilities)}
      ${r.longLiabilities.length ? `<tr><td colspan="2"><b>الخصوم غير المتداولة</b></td></tr>${stmtRows(r.longLiabilities)}` : ''}
      <tr class="total"><td>إجمالي الخصوم</td><td class="num">${money(r.totalLiabilities)}</td></tr>
      <tr><td colspan="2"><b>حقوق الملكية</b></td></tr>${stmtRows(r.equity)}
      <tr class="total"><td>إجمالي حقوق الملكية</td><td class="num">${money(r.totalEquity)}</td></tr>
      <tr class="total"><td>إجمالي الخصوم وحقوق الملكية</td><td class="num">${money(r.totalLiabilitiesAndEquity)}</td></tr></table>
      <p>${r.balanced ? '<span class="badge ok">القائمة متوازنة</span>' : '<span class="badge bad">القائمة غير متوازنة</span>'}</p>`;
  });
  $('#bf').onsubmit = (e) => { e.preventDefault(); load(); };
  load();
}

async function rCashFlow(el) {
  el.innerHTML = `<div class="card statement">${rangeBar()}<div id="out"></div></div>`;
  bindRange(guard(async (f) => {
    const r = await api('/api/reports/cash-flow?' + new URLSearchParams(f));
    $('#out').innerHTML = reportHeader('قائمة التدفقات النقدية', `للفترة من ${r.from} إلى ${r.to}`) + `<table>
      <tr><td>النقدية أول الفترة</td><td class="num">${money(r.opening)}</td></tr>
      <tr><td colspan="2"><b>التدفقات من الأنشطة التشغيلية</b></td></tr>${stmtRows(r.operating)}
      <tr class="total"><td>صافي التدفقات التشغيلية</td><td class="num">${money(r.netOperating)}</td></tr>
      <tr><td colspan="2"><b>أنشطة أخرى</b></td></tr>${stmtRows(r.other)}
      <tr class="total"><td>صافي التغير في النقدية</td><td class="num">${money(r.netChange)}</td></tr>
      <tr class="total"><td>النقدية آخر الفترة</td><td class="num">${money(r.closing)}</td></tr></table>`;
  }));
}

async function rTrial(el) {
  el.innerHTML = `<div class="card">${rangeBar(null, { from: today().slice(0, 4) + '-01-01' })}<div id="out"></div></div>`;
  bindRange(guard(async (f) => {
    const r = await api('/api/reports/trial-balance?' + new URLSearchParams(f));
    $('#out').innerHTML = reportHeader('ميزان المراجعة', `${r.from} إلى ${r.to}`) + `<div class="table-wrap"><table>
      <tr><th>الرمز</th><th>الحساب</th><th class="num">حركة مدينة</th><th class="num">حركة دائنة</th><th class="num">رصيد مدين</th><th class="num">رصيد دائن</th></tr>
      ${r.rows.map((x) => `<tr><td>${x.code}</td><td>${esc(x.name)}</td><td class="num">${money(x.debit)}</td><td class="num">${money(x.credit)}</td><td class="num">${x.balanceDebit ? money(x.balanceDebit) : ''}</td><td class="num">${x.balanceCredit ? money(x.balanceCredit) : ''}</td></tr>`).join('')}
      <tr class="total"><td colspan="2">الإجمالي</td><td class="num">${money(r.totals.debit)}</td><td class="num">${money(r.totals.credit)}</td><td class="num">${money(r.totals.balanceDebit)}</td><td class="num">${money(r.totals.balanceCredit)}</td></tr></table></div>
      <p>${r.balanced ? '<span class="badge ok">الميزان متوازن</span>' : '<span class="badge bad">الميزان غير متوازن</span>'}</p>`;
  }));
}

async function rLedger(el, params) {
  await loadAccounts();
  el.innerHTML = `<div class="card">${rangeBar(null, { from: today().slice(0, 4) + '-01-01', extra: `<label>الحساب<select name="code">${accOptions(params.get('code') || '1101')}</select></label>` })}<div id="out"></div></div>`;
  bindRange(guard(async (f) => {
    const r = await api('/api/reports/ledger?' + new URLSearchParams(f));
    $('#out').innerHTML = reportHeader(`كشف حساب: ${esc(r.account.code)} - ${esc(r.account.name)}`, `${r.from} إلى ${r.to}`) + `<div class="table-wrap"><table>
      <tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th class="num">مدين</th><th class="num">دائن</th><th class="num">الرصيد</th></tr>
      <tr><td colspan="5">الرصيد الافتتاحي</td><td class="num">${money(r.opening)}</td></tr>
      ${r.rows.map((x) => `<tr><td>${x.date}</td><td>#${x.entry_id}</td><td>${esc(x.description)}</td><td class="num">${x.debit ? money(x.debit) : ''}</td><td class="num">${x.credit ? money(x.credit) : ''}</td><td class="num">${money(x.balance)}</td></tr>`).join('')}
      <tr class="total"><td colspan="5">الرصيد الختامي</td><td class="num">${money(r.closing)}</td></tr></table></div>`;
  }));
}

function quarterRange() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  const from = new Date(Date.UTC(d.getFullYear(), q * 3, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(d.getFullYear(), q * 3 + 3, 0)).toISOString().slice(0, 10);
  return { from, to };
}

async function rVat(el) {
  el.innerHTML = `<div class="card">${rangeBar(null, quarterRange())}<div id="out"></div></div>`;
  bindRange(guard(async (f) => {
    const r = await api('/api/reports/vat-return?' + new URLSearchParams(f));
    const row = (b) => `<tr><td>${b.no}</td><td>${esc(b.name)}</td><td class="num">${money(b.amount)}</td><td class="num">${money(b.adjustment)}</td><td class="num">${money(b.vat)}</td></tr>`;
    $('#out').innerHTML = reportHeader('إقرار ضريبة القيمة المضافة', `الفترة الضريبية من ${r.from} إلى ${r.to}`) + `<div class="table-wrap"><table>
      <tr><th>#</th><th>البند</th><th class="num">المبلغ (ريال)</th><th class="num">التعديلات</th><th class="num">مبلغ الضريبة</th></tr>
      <tr><td colspan="5"><b>ضريبة القيمة المضافة على المبيعات</b></td></tr>
      ${r.sales.map(row).join('')}<tr class="total">${row(r.totalSales).slice(4)}
      <tr><td colspan="5"><b>ضريبة القيمة المضافة على المشتريات</b></td></tr>
      ${r.purchases.map(row).join('')}<tr class="total">${row(r.totalPurchases).slice(4)}
      <tr class="total"><td>13</td><td colspan="3">${r.box13.name}</td><td class="num">${money(r.box13.vat)}</td></tr>
      <tr><td>14</td><td colspan="3">${r.box14.name}</td><td class="num">${money(r.box14.vat)}</td></tr>
      <tr><td>15</td><td colspan="3">${r.box15.name}</td><td class="num">${money(r.box15.vat)}</td></tr>
      <tr class="total"><td>16</td><td colspan="3">صافي الضريبة المستحقة (أو المستردة)</td><td class="num">${money(r.netVatDue)}</td></tr>
    </table></div>
    <div class="note">${esc(r.notes.text)}<br>مشتريات من أفراد خلال الفترة: ${money(r.notes.individualPurchases)} ريال.</div>`;
  }));
}

async function rZakat(el) {
  el.innerHTML = `<div class="card"><form class="toolbar" id="zf"><label>كما في<input type="date" name="asOf" value="${today()}"></label>
    <label>السنة<select name="calendar"><option value="hijri">هجرية (2.5%)</option><option value="gregorian">ميلادية (2.5776%)</option></select></label>
    <button class="btn secondary">احسب</button><button type="button" class="btn secondary" onclick="window.print()">طباعة</button></form><div id="out"></div></div>`;
  const load = guard(async () => {
    const r = await api('/api/reports/zakat?' + new URLSearchParams(formData($('#zf'))));
    $('#out').innerHTML = reportHeader('تقدير الوعاء الزكوي', `كما في ${r.asOf}`) + `<table>
      <tr><td>النقدية (الصندوق والبنك ونقاط البيع)</td><td class="num">${money(r.cash)}</td></tr>
      <tr><td>الذمم المدينة</td><td class="num">${money(r.receivables)}</td></tr>
      <tr><td>مخزون الذهب (${r.inventoryBasis === 'market' ? 'بالقيمة السوقية' : 'بالتكلفة'})</td><td class="num">${money(r.inventoryValue)}</td></tr>
      <tr><td>ضريبة مدخلات قابلة للاسترداد</td><td class="num">${money(r.vatInput)}</td></tr>
      <tr class="total"><td>إجمالي الأصول الزكوية</td><td class="num">${money(r.assets)}</td></tr>
      <tr><td>يُطرح: الالتزامات المتداولة</td><td class="num">(${money(r.liabilities)})</td></tr>
      <tr class="total"><td>الوعاء الزكوي</td><td class="num">${money(r.base)}</td></tr>
      <tr class="total"><td>الزكاة التقديرية (${r.rate}%)</td><td class="num">${money(r.zakat)}</td></tr></table>
      <div class="note">${esc(r.disclaimer)}</div>`;
  });
  $('#zf').onsubmit = (e) => { e.preventDefault(); load(); };
  load();
}

// ---------------- الإعدادات ----------------

async function pageSettings() {
  title('الإعدادات');
  const s = state.settings = await api('/api/settings');
  const f = (k, l, attrs = '') => `<label>${l}<input name="${k}" value="${esc(s[k] || '')}" ${attrs}></label>`;
  $('#view').innerHTML = `<form id="setForm">
    <div class="card"><h3>بيانات المنشأة (تظهر في الفواتير)</h3><div class="form">
      ${f('company_name', 'اسم المنشأة', 'required')}${f('company_name_en', 'الاسم بالإنجليزية')}
      ${f('vat_number', 'الرقم الضريبي (15 رقم)', 'maxlength="15" inputmode="numeric"')}${f('cr_number', 'السجل التجاري')}
      ${f('phone', 'الهاتف')}${f('address_street', 'الشارع')}${f('address_building', 'رقم المبنى')}
      ${f('address_district', 'الحي')}${f('address_city', 'المدينة')}${f('address_postal', 'الرمز البريدي')}
    </div></div>
    <div class="card"><h3>الذهب والضريبة</h3><div class="form">
      ${f('gold_price_24', 'سعر جرام عيار 24 (ريال)', 'type="number" step="0.01"')}
      ${f('default_making_per_gram', 'المصنعية الافتراضية للجرام', 'type="number" step="0.01"')}
      ${f('vat_rate', 'نسبة ضريبة القيمة المضافة %', 'type="number" step="0.01"')}
      ${f('invoice_prefix_sale', 'بادئة فواتير البيع')}${f('invoice_prefix_purchase', 'بادئة فواتير الشراء')}
    </div></div>
    <div class="card"><h3>الربط مع هيئة الزكاة والضريبة والجمارك (منصة فاتورة)</h3>
      <div class="note">المرحلة الأولى (رمز QR والفاتورة الإلكترونية) تعمل تلقائياً. للمرحلة الثانية (الربط والتكامل): سجّل منشأتك في بوابة فاتورة، واحصل على رمز OTP، ثم أدخل بيانات شهادة CSID هنا. يُنصح بالتجربة على بيئة المحاكاة أولاً.</div>
      <div class="form">
        <label>البيئة<select name="zatca_env">${['sandbox', 'simulation', 'production'].map((e) => `<option value="${e}" ${s.zatca_env === e ? 'selected' : ''}>${{ sandbox: 'بيئة المطورين', simulation: 'بيئة المحاكاة', production: 'الإنتاج (فعلي)' }[e]}</option>`).join('')}</select></label>
        ${f('zatca_csid', 'شهادة CSID (binarySecurityToken)')}
        ${f('zatca_secret', 'الرمز السري (secret)', 'type="password" autocomplete="off"')}
        <label>عداد الفواتير الحالي (ICV)<input value="${esc(s.zatca_last_icv)}" disabled></label>
      </div></div>
    <div class="actions"><button class="btn">حفظ الإعدادات</button>${can('users') ? '<a class="btn secondary" href="/api/backup">تنزيل نسخة احتياطية</a>' : ''}</div>
  </form>
  <form class="card" id="pwForm" style="margin-top:18px"><h3>تغيير كلمة المرور</h3><div class="form">
    <label>الحالية<input type="password" name="current" required></label><label>الجديدة<input type="password" name="next" minlength="8" required></label>
  </div><div class="actions" style="margin-top:12px"><button class="btn secondary">تغيير</button></div></form>`;
  $('#setForm').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/settings', { method: 'PUT', body: formData(e.target) });
    state.settings = await api('/api/settings');
    $('#brandName').textContent = state.settings.company_name;
    renderGoldPrice();
    toast('تم حفظ الإعدادات');
  });
  $('#pwForm').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/auth/password', { method: 'POST', body: formData(e.target) });
    e.target.reset();
    toast('تم تغيير كلمة المرور');
  });
}

async function pageUsers() {
  title('المستخدمون');
  const rows = await api('/api/users');
  $('#view').innerHTML = `
    <form class="card" id="uf"><h3>إضافة مستخدم</h3><div class="form">
      <label>الاسم<input name="name" required></label><label>اسم المستخدم<input name="username" required></label>
      <label>كلمة المرور<input type="password" name="password" minlength="8" required></label>
      <label>الصلاحية<select name="role">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    </div><div class="actions" style="margin-top:12px"><button class="btn">إضافة</button></div>
    <p class="muted">الكاشير: فواتير البيع والمرتجعات فقط · المحاسب: كل العمليات والتقارير · المدير: كل شيء بما فيه الإعدادات والمستخدمين.</p></form>
    <div class="card"><table><tr><th>الاسم</th><th>المستخدم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr>
      ${rows.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${ROLE_LABEL[u.role]}</td>
        <td>${u.active ? '<span class="badge ok">نشط</span>' : '<span class="badge bad">معطل</span>'}</td>
        <td>${u.id !== state.user.id ? `<button class="btn secondary sm" data-t="${u.id}" data-a="${u.active ? 0 : 1}">${u.active ? 'تعطيل' : 'تفعيل'}</button>` : ''}</td></tr>`).join('')}</table></div>`;
  $('#uf').onsubmit = guard(async (e) => {
    e.preventDefault();
    await api('/api/users', { method: 'POST', body: formData(e.target) });
    toast('تمت إضافة المستخدم');
    pageUsers();
  });
  $$('[data-t]').forEach((b) => b.onclick = guard(async () => {
    await api(`/api/users/${b.dataset.t}`, { method: 'PATCH', body: { active: b.dataset.a === '1' } });
    pageUsers();
  }));
}

window.closeModal = closeModal;
boot().catch((e) => { document.body.innerHTML = `<p style="padding:20px">تعذر الاتصال بالخادم: ${esc(e.message)}</p>`; });
