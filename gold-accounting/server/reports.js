'use strict';
const { getSettings } = require('./db');
const { KARATS, r2, r3, stockOf, karatPrice } = require('./accounting');

const TYPE_LABELS = { asset: 'الأصول', liability: 'الخصوم', equity: 'حقوق الملكية', revenue: 'الإيرادات', expense: 'المصروفات' };

function monthRange(year, month) {
  const y = Number(year);
  const mo = Number(month);
  const from = `${y}-${String(mo).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const to = `${y}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

/** أرصدة الحسابات ضمن فترة (أو حتى تاريخ إن لم تحدد البداية) */
function accountBalances(db, { from = '0000-01-01', to = '9999-12-31' } = {}) {
  const rows = db.prepare(`
    SELECT a.code, a.name, a.type, a.current,
      COALESCE(SUM(jl.debit),0) AS debit, COALESCE(SUM(jl.credit),0) AS credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_code = a.code
      AND jl.entry_id IN (SELECT id FROM journal_entries WHERE date BETWEEN ? AND ?)
    GROUP BY a.code ORDER BY a.code`).all(from, to);
  return rows.map((r) => {
    const debit = r2(r.debit);
    const credit = r2(r.credit);
    const natural = r.type === 'asset' || r.type === 'expense' ? r2(debit - credit) : r2(credit - debit);
    return { ...r, debit, credit, balance: natural };
  });
}

function trialBalance(db, { from, to }) {
  const rows = accountBalances(db, { from, to }).filter((r) => r.debit || r.credit);
  const out = rows.map((r) => {
    const net = r2(r.debit - r.credit);
    return { code: r.code, name: r.name, type: r.type, debit: r.debit, credit: r.credit, balanceDebit: net > 0 ? net : 0, balanceCredit: net < 0 ? -net : 0 };
  });
  const totals = out.reduce((t, r) => ({
    debit: r2(t.debit + r.debit), credit: r2(t.credit + r.credit),
    balanceDebit: r2(t.balanceDebit + r.balanceDebit), balanceCredit: r2(t.balanceCredit + r.balanceCredit),
  }), { debit: 0, credit: 0, balanceDebit: 0, balanceCredit: 0 });
  return { from, to, rows: out, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 };
}

function incomeStatement(db, { from, to }) {
  const bal = accountBalances(db, { from, to });
  const pick = (pred) => bal.filter(pred).filter((r) => r.balance !== 0).map((r) => ({ code: r.code, name: r.name, amount: r.balance }));
  const salesGold = bal.find((r) => r.code === '4101').balance;
  const making = bal.find((r) => r.code === '4102').balance;
  const returns = -bal.find((r) => r.code === '4201').balance; // رصيد مدين
  const netSales = r2(salesGold + making - returns);
  const cogs = bal.find((r) => r.code === '5101').balance;
  const grossProfit = r2(netSales - cogs);
  const otherRevenue = pick((r) => r.type === 'revenue' && !['4101', '4102', '4201'].includes(r.code));
  const otherRevenueTotal = r2(otherRevenue.reduce((s, r) => s + r.amount, 0));
  const expenses = pick((r) => r.type === 'expense' && r.code !== '5101' && r.code !== '6201');
  const expensesTotal = r2(expenses.reduce((s, r) => s + r.amount, 0));
  const operatingProfit = r2(grossProfit + otherRevenueTotal - expensesTotal);
  const zakat = bal.find((r) => r.code === '6201').balance;
  const netProfit = r2(operatingProfit - zakat);
  return {
    from, to, salesGold, making, returns, netSales, cogs, grossProfit,
    grossMargin: netSales ? r2((grossProfit / netSales) * 100) : 0,
    otherRevenue, otherRevenueTotal, expenses, expensesTotal, operatingProfit, zakat, netProfit,
  };
}

function balanceSheet(db, { asOf }) {
  const bal = accountBalances(db, { to: asOf });
  const section = (type, current) => bal
    .filter((r) => r.type === type && (current == null || !!r.current === current) && r.balance !== 0)
    .map((r) => ({ code: r.code, name: r.name, amount: r.balance }));
  const sum = (arr) => r2(arr.reduce((s, r) => s + r.amount, 0));

  const currentAssets = section('asset', true);
  const fixedAssets = section('asset', false);
  const currentLiabilities = section('liability', true);
  const longLiabilities = section('liability', false);
  const equity = section('equity');
  const revenue = sum(bal.filter((r) => r.type === 'revenue').map((r) => ({ amount: r.balance })));
  const expense = sum(bal.filter((r) => r.type === 'expense').map((r) => ({ amount: r.balance })));
  const earnings = r2(revenue - expense);
  if (earnings !== 0) equity.push({ code: '—', name: 'صافي الأرباح (الخسائر) المتراكمة غير المقفلة', amount: earnings });

  const totalAssets = r2(sum(currentAssets) + sum(fixedAssets));
  const totalLiabilities = r2(sum(currentLiabilities) + sum(longLiabilities));
  const totalEquity = sum(equity);
  return {
    asOf,
    currentAssets, totalCurrentAssets: sum(currentAssets),
    fixedAssets, totalFixedAssets: sum(fixedAssets),
    totalAssets,
    currentLiabilities, totalCurrentLiabilities: sum(currentLiabilities),
    longLiabilities, totalLongLiabilities: sum(longLiabilities),
    totalLiabilities,
    equity, totalEquity,
    totalLiabilitiesAndEquity: r2(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

/** قائمة التدفقات النقدية (الطريقة المباشرة المبسطة) */
function cashFlow(db, { from, to }) {
  const cashAccounts = ['1101', '1102', '1103'];
  const opening = r2(accountBalances(db, { to: prevDay(from) }).filter((r) => cashAccounts.includes(r.code)).reduce((s, r) => s + r.balance, 0));
  const rows = db.prepare(`
    SELECT je.ref_type, SUM(jl.debit - jl.credit) AS net
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
    WHERE jl.account_code IN ('1101','1102','1103') AND je.date BETWEEN ? AND ?
    GROUP BY je.ref_type`).all(from, to);
  const inv = db.prepare(`
    SELECT i.type, SUM(jl.debit - jl.credit) AS net
    FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id JOIN invoices i ON i.id = je.ref_id
    WHERE je.ref_type = 'invoice' AND jl.account_code IN ('1101','1102','1103') AND je.date BETWEEN ? AND ?
    GROUP BY i.type`).all(from, to);
  const byType = Object.fromEntries(inv.map((r) => [r.type, r2(r.net)]));
  const byRef = Object.fromEntries(rows.map((r) => [r.ref_type, r2(r.net)]));
  const operating = [
    { name: 'متحصلات من المبيعات', amount: byType.sale || 0 },
    { name: 'مدفوعات مرتجعات المبيعات', amount: byType.sale_return || 0 },
    { name: 'مدفوعات مشتريات الذهب', amount: byType.purchase || 0 },
    { name: 'متحصلات مرتجعات المشتريات', amount: byType.purchase_return || 0 },
    { name: 'المصروفات التشغيلية', amount: byRef.expense || 0 },
  ];
  const other = [{ name: 'قيود يدوية (تمويل/استثمار/أخرى)', amount: r2((byRef.manual || 0) + (byRef.opening_stock || 0)) }];
  const netOperating = r2(operating.reduce((s, r) => s + r.amount, 0));
  const netOther = r2(other.reduce((s, r) => s + r.amount, 0));
  const netChange = r2(netOperating + netOther);
  return { from, to, opening, operating, netOperating, other, netOther, netChange, closing: r2(opening + netChange) };
}

function prevDay(d) {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function ledger(db, { code, from, to }) {
  const acc = db.prepare('SELECT * FROM accounts WHERE code = ?').get(code);
  if (!acc) return null;
  const debitNature = acc.type === 'asset' || acc.type === 'expense';
  const ob = db.prepare(`SELECT COALESCE(SUM(jl.debit),0) d, COALESCE(SUM(jl.credit),0) c FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id WHERE jl.account_code = ? AND je.date < ?`).get(code, from);
  let running = r2(debitNature ? ob.d - ob.c : ob.c - ob.d);
  const opening = running;
  const rows = db.prepare(`SELECT je.id entry_id, je.date, je.description, jl.debit, jl.credit, jl.memo FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id WHERE jl.account_code = ? AND je.date BETWEEN ? AND ?
    ORDER BY je.date, je.id, jl.id`).all(code, from, to).map((r) => {
    running = r2(running + (debitNature ? r.debit - r.credit : r.credit - r.debit));
    return { ...r, balance: running };
  });
  return { account: acc, from, to, opening, rows, closing: running };
}

function inventory(db) {
  const settings = getSettings(db);
  const price24 = Number(settings.gold_price_24 || 0);
  const rows = KARATS.map((k) => {
    const s = stockOf(db, k);
    const marketPrice = karatPrice(price24, k);
    return {
      karat: k, weight: s.weight, cost: s.cost, avgCost: r2(s.avgCost),
      pure24: r3((s.weight * k) / 24),
      marketPrice, marketValue: r2(s.weight * marketPrice),
    };
  });
  const totals = rows.reduce((t, r) => ({
    weight: r3(t.weight + r.weight), cost: r2(t.cost + r.cost), pure24: r3(t.pure24 + r.pure24), marketValue: r2(t.marketValue + r.marketValue),
  }), { weight: 0, cost: 0, pure24: 0, marketValue: 0 });
  totals.unrealizedGain = r2(totals.marketValue - totals.cost);
  return { price24, rows, totals };
}

function stockMovements(db, { karat, from, to }) {
  return db.prepare(`SELECT * FROM stock_moves WHERE (? IS NULL OR karat = ?) AND date BETWEEN ? AND ? ORDER BY date, id`)
    .all(karat || null, karat || null, from, to);
}

/**
 * الإقرار الضريبي لضريبة القيمة المضافة حسب نموذج الهيئة.
 */
function vatReturn(db, { from, to }) {
  const lines = db.prepare(`
    SELECT i.type, i.purchase_source, l.vat_rate,
      SUM(l.line_subtotal) - SUM(CASE WHEN i.subtotal > 0 THEN i.discount * l.line_subtotal / i.subtotal ELSE 0 END) AS net,
      SUM(l.vat_amount) AS vat
    FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
    WHERE i.date BETWEEN ? AND ?
    GROUP BY i.type, i.purchase_source, l.vat_rate`).all(from, to);
  const g = (pred) => lines.filter(pred).reduce((a, r) => ({ net: r2(a.net + r.net), vat: r2(a.vat + r.vat) }), { net: 0, vat: 0 });

  const stdSales = g((r) => r.type === 'sale' && r.vat_rate > 0);
  const stdSalesRet = g((r) => r.type === 'sale_return' && r.vat_rate > 0);
  const zeroSales = g((r) => r.type === 'sale' && r.vat_rate === 0);
  const zeroSalesRet = g((r) => r.type === 'sale_return' && r.vat_rate === 0);
  const stdPurch = g((r) => r.type === 'purchase' && r.vat_rate > 0);
  const stdPurchRet = g((r) => r.type === 'purchase_return' && r.vat_rate > 0);
  const zeroPurch = g((r) => r.type === 'purchase' && r.vat_rate === 0 && r.purchase_source !== 'individual');
  const zeroPurchRet = g((r) => r.type === 'purchase_return' && r.vat_rate === 0 && r.purchase_source !== 'individual');
  const individualPurch = g((r) => r.type === 'purchase' && r.purchase_source === 'individual');

  const exp = db.prepare(`SELECT COALESCE(SUM(CASE WHEN vat_amount > 0 THEN amount END),0) std_net, COALESCE(SUM(vat_amount),0) vat,
    COALESCE(SUM(CASE WHEN vat_amount = 0 THEN amount END),0) exempt_net FROM expenses WHERE date BETWEEN ? AND ?`).get(from, to);

  const box = (no, name, amount, adjustment, vat) => ({ no, name, amount: r2(amount), adjustment: r2(adjustment), vat: r2(vat) });
  const sales = [
    box(1, 'المبيعات الخاضعة للنسبة الأساسية (15%)', stdSales.net, -stdSalesRet.net, stdSales.vat - stdSalesRet.vat),
    box(2, 'المبيعات للمواطنين (الخدمات الصحية الخاصة/التعليم الأهلي الخاص)', 0, 0, 0),
    box(3, 'المبيعات المحلية الخاضعة للنسبة الصفرية (الذهب الاستثماري)', zeroSales.net, -zeroSalesRet.net, 0),
    box(4, 'الصادرات', 0, 0, 0),
    box(5, 'المبيعات المعفاة', 0, 0, 0),
  ];
  const totalSales = box(6, 'إجمالي المبيعات', sales.reduce((s, b) => s + b.amount, 0), sales.reduce((s, b) => s + b.adjustment, 0), sales.reduce((s, b) => s + b.vat, 0));

  const purchases = [
    box(7, 'المشتريات الخاضعة للنسبة الأساسية (15%)', stdPurch.net + exp.std_net, -stdPurchRet.net, stdPurch.vat + exp.vat - stdPurchRet.vat),
    box(8, 'الاستيرادات الخاضعة لضريبة القيمة المضافة التي تدفع في الجمارك', 0, 0, 0),
    box(9, 'الاستيرادات الخاضعة للضريبة التي تطبق عليها آلية الاحتساب العكسي', 0, 0, 0),
    box(10, 'المشتريات الخاضعة للنسبة الصفرية', zeroPurch.net, -zeroPurchRet.net, 0),
    box(11, 'المشتريات المعفاة', exp.exempt_net, 0, 0),
  ];
  const totalPurchases = box(12, 'إجمالي المشتريات', purchases.reduce((s, b) => s + b.amount, 0), purchases.reduce((s, b) => s + b.adjustment, 0), purchases.reduce((s, b) => s + b.vat, 0));

  const netDue = r2(totalSales.vat - totalPurchases.vat);
  return {
    from, to, sales, totalSales, purchases, totalPurchases,
    box13: { name: 'إجمالي ضريبة القيمة المضافة المستحقة عن الفترة الحالية', vat: netDue },
    box14: { name: 'تصحيحات من الفترات السابقة (بين ±5,000 ريال)', vat: 0 },
    box15: { name: 'ضريبة القيمة المضافة المرحلة من الفترة/الفترات السابقة', vat: 0 },
    netVatDue: netDue,
    notes: {
      individualPurchases: individualPurch.net,
      text: 'مشتريات الذهب المستعمل من الأفراد غير المسجلين لا تتضمن ضريبة مدخلات ولا تُدرج في خانات الإقرار. تأكد من مطابقة الأرقام مع سجلاتك قبل تقديم الإقرار في بوابة الهيئة.',
    },
  };
}

/**
 * تقدير الزكاة (تقريبي - للاسترشاد):
 * الوعاء الزكوي = الأصول الزكوية (النقد + الذمم المدينة + مخزون الذهب بالقيمة السوقية) - الالتزامات المتداولة.
 * النسبة 2.5% للسنة الهجرية أو 2.5776% للسنة الميلادية.
 */
function zakatEstimate(db, { asOf, calendar = 'hijri' }) {
  const bal = accountBalances(db, { to: asOf });
  const get = (c) => (bal.find((r) => r.code === c) || { balance: 0 }).balance;
  const inv = inventory(db);
  const cash = r2(get('1101') + get('1102') + get('1103'));
  const receivables = get('1201');
  const inventoryValue = inv.price24 > 0 ? inv.totals.marketValue : inv.totals.cost;
  const vatInput = get('1401');
  const assets = r2(cash + receivables + inventoryValue + vatInput);
  const liabilities = r2(get('2101') + get('2201') + get('2202') + get('2401'));
  const base = r2(Math.max(0, assets - liabilities));
  const rate = calendar === 'gregorian' ? 2.5776 : 2.5;
  return {
    asOf, calendar, cash, receivables, inventoryValue, inventoryBasis: inv.price24 > 0 ? 'market' : 'cost', vatInput,
    assets, liabilities, base, rate, zakat: r2((base * rate) / 100),
    disclaimer: 'تقدير استرشادي فقط بطريقة صافي الأصول المتداولة. الإقرار الزكوي الرسمي يقدم عبر بوابة الهيئة ويُفضل مراجعته مع محاسب قانوني.',
  };
}

function monthlyReport(db, { year, month }) {
  const { from, to } = monthRange(year, month);
  const agg = (type) => db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) total, COALESCE(SUM(taxable_amount),0) taxable,
    COALESCE(SUM(vat_amount),0) vat, COALESCE(SUM(cost_of_goods),0) cogs, COALESCE(SUM(making_value),0) making
    FROM invoices WHERE type = ? AND date BETWEEN ? AND ?`).get(type, from, to);
  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'n' ? v : r2(v)]));
  const sales = round(agg('sale'));
  const saleReturns = round(agg('sale_return'));
  const purchases = round(agg('purchase'));
  const purchaseReturns = round(agg('purchase_return'));

  const weights = db.prepare(`SELECT i.type, l.karat, SUM(l.weight) w FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
    WHERE i.date BETWEEN ? AND ? GROUP BY i.type, l.karat`).all(from, to);
  const byKarat = KARATS.map((k) => {
    const w = (t) => r3((weights.find((x) => x.type === t && x.karat === k) || { w: 0 }).w);
    return { karat: k, sold: w('sale'), returned: w('sale_return'), purchased: w('purchase'), purchaseReturned: w('purchase_return') };
  });

  const daily = db.prepare(`SELECT date, SUM(CASE WHEN type='sale' THEN total WHEN type='sale_return' THEN -total ELSE 0 END) sales,
    SUM(CASE WHEN type='purchase' THEN total WHEN type='purchase_return' THEN -total ELSE 0 END) purchases, COUNT(*) n
    FROM invoices WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from, to).map((r) => ({ ...r, sales: r2(r.sales), purchases: r2(r.purchases) }));

  const byPayment = db.prepare(`SELECT payment_method, SUM(total) total, COUNT(*) n FROM invoices WHERE type='sale' AND date BETWEEN ? AND ?
    GROUP BY payment_method`).all(from, to).map((r) => ({ ...r, total: r2(r.total) }));

  const expenses = db.prepare(`SELECT a.name, SUM(e.amount) amount FROM expenses e JOIN accounts a ON a.code = e.account_code
    WHERE e.date BETWEEN ? AND ? GROUP BY a.code ORDER BY amount DESC`).all(from, to).map((r) => ({ ...r, amount: r2(r.amount) }));

  const topCustomers = db.prepare(`SELECT COALESCE(party_name,'عميل نقدي') name, SUM(total) total, COUNT(*) n FROM invoices
    WHERE type='sale' AND date BETWEEN ? AND ? GROUP BY COALESCE(party_name,'عميل نقدي') ORDER BY total DESC LIMIT 5`).all(from, to)
    .map((r) => ({ ...r, total: r2(r.total) }));

  const income = incomeStatement(db, { from, to });
  const vat = vatReturn(db, { from, to });
  return {
    year: Number(year), month: Number(month), from, to,
    sales, saleReturns, purchases, purchaseReturns, byKarat, daily, byPayment, expenses, topCustomers,
    income, vatDue: vat.netVatDue, inventory: inventory(db),
    avgInvoice: sales.n ? r2(sales.total / sales.n) : 0,
  };
}

function dashboard(db) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const { from, to } = monthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const salesOn = (a, b) => db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN type='sale' THEN total ELSE -total END),0) total
    FROM invoices WHERE type IN ('sale','sale_return') AND date BETWEEN ? AND ?`).get(a, b);
  const bal = accountBalances(db, {});
  const get = (c) => bal.find((r) => r.code === c).balance;
  const income = incomeStatement(db, { from, to });
  const recent = db.prepare('SELECT id, number, type, date, party_name, total FROM invoices ORDER BY id DESC LIMIT 8').all();
  const trend = db.prepare(`SELECT substr(date,1,7) ym, SUM(CASE WHEN type='sale' THEN total WHEN type='sale_return' THEN -total ELSE 0 END) sales
    FROM invoices WHERE date >= date('now','-11 months','start of month') GROUP BY ym ORDER BY ym`).all().map((r) => ({ ...r, sales: r2(r.sales) }));
  const t = salesOn(today, today);
  const mth = salesOn(from, to);
  return {
    today: { n: t.n, total: r2(t.total) },
    month: { n: mth.n, total: r2(mth.total), grossProfit: income.grossProfit, netProfit: income.netProfit },
    cash: get('1101'), bank: r2(get('1102') + get('1103')), receivables: get('1201'), payables: get('2101'),
    vatPayable: r2(get('2201') - get('1401')),
    inventory: inventory(db), recent, trend,
  };
}

module.exports = {
  TYPE_LABELS, monthRange, accountBalances, trialBalance, incomeStatement, balanceSheet, cashFlow, ledger,
  inventory, stockMovements, vatReturn, zakatEstimate, monthlyReport, dashboard,
};
