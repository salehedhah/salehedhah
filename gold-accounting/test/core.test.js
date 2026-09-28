'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { openDb, setSettings } = require('../server/db');
const acc = require('../server/accounting');
const reports = require('../server/reports');
const zatca = require('../server/zatca');

function freshDb() {
  const db = openDb(':memory:');
  setSettings(db, { company_name: 'محل الاختبار', vat_number: '300000000000003', gold_price_24: '400' });
  return db;
}

test('QR TLV يحتوي على الحقول الخمسة', () => {
  const b64 = zatca.buildQrTlv({ sellerName: 'محل', vatNumber: '300000000000003', timestamp: '2026-09-01T10:00:00', total: 115, vatTotal: 15 });
  const d = zatca.decodeQrTlv(b64);
  assert.deepStrictEqual(d, { 1: 'محل', 2: '300000000000003', 3: '2026-09-01T10:00:00', 4: '115.00', 5: '15.00' });
});

test('التحقق من الرقم الضريبي', () => {
  assert.ok(zatca.isValidVatNumber('310122393500003'));
  assert.ok(!zatca.isValidVatNumber('123'));
  assert.ok(!zatca.isValidVatNumber('410122393500003'));
});

test('حساب الفاتورة: مشغولات 15% وذهب استثماري 0%', () => {
  const c = acc.computeInvoice({
    type: 'sale', settings: { vat_rate: '15', gold_price_24: '400' },
    lines: [
      { karat: 21, weight: 10, making_per_gram: 20, category: 'jewelry' },
      { karat: 24, weight: 5, category: 'investment' },
    ],
  });
  assert.strictEqual(c.lines[0].price_per_gram, 350);
  assert.strictEqual(c.lines[0].line_subtotal, 3700);
  assert.strictEqual(c.lines[0].vat_amount, 555);
  assert.strictEqual(c.lines[1].vat_amount, 0);
  assert.strictEqual(c.total, 3700 + 555 + 2000);
});

test('دورة كاملة: رصيد افتتاحي، شراء، بيع، مرتجع، مصروف — والقوائم متوازنة', () => {
  const db = freshDb();
  const d = '2026-09-10';
  acc.openingStock(db, { date: '2026-09-01', karat: 21, weight: 100, costPerGram: 300 });
  const p = acc.createInvoice(db, { type: 'purchase', date: d, purchase_source: 'vat_supplier', payment_method: 'bank',
    lines: [{ karat: 21, weight: 50, price_per_gram: 320, making_per_gram: 10 }] });
  assert.strictEqual(p.vat_amount, acc.r2(50 * 330 * 0.15));
  assert.strictEqual(p.icv, null);

  const ind = acc.createInvoice(db, { type: 'purchase', date: d, purchase_source: 'individual', party_name: 'فرد', payment_method: 'cash',
    lines: [{ karat: 18, weight: 20, price_per_gram: 250 }] });
  assert.strictEqual(ind.vat_amount, 0);

  const s = acc.createInvoice(db, { type: 'sale', date: d, payment_method: 'cash', discount: 100,
    lines: [{ karat: 21, weight: 30, making_per_gram: 25 }] });
  assert.ok(s.qr_tlv && s.invoice_hash && s.icv === 1);
  // avg cost = (30000 + 16500) / 150 = 310
  assert.strictEqual(s.cost_of_goods, 9300);
  assert.strictEqual(s.taxable_amount, 30 * 375 - 100);
  assert.strictEqual(s.vat_amount, acc.r2((30 * 375 - 100) * 0.15));

  const ret = acc.createInvoice(db, { type: 'sale_return', date: d, original_invoice_id: s.id, payment_method: 'cash',
    lines: [{ karat: 21, weight: 5, price_per_gram: 350, making_per_gram: 25 }] });
  assert.strictEqual(ret.icv, 2);
  assert.strictEqual(ret.previous_hash, s.invoice_hash);
  assert.strictEqual(ret.cost_of_goods, 1550);

  acc.createExpense(db, { date: d, account_code: '6102', description: 'إيجار', amount: 5000, vat_amount: 750, payment_method: 'bank' });

  // الأرصدة الافتتاحية للبنك حتى لا يكون سالباً (غير مؤثر على التوازن)
  acc.postJournal(db, { date: '2026-09-01', description: 'رأس مال', lines: [{ account_code: '1102', debit: 100000 }, { account_code: '3101', credit: 100000 }] });

  const tb = reports.trialBalance(db, { from: '2026-01-01', to: '2026-12-31' });
  assert.ok(tb.balanced, 'ميزان المراجعة متوازن');

  const bs = reports.balanceSheet(db, { asOf: '2026-12-31' });
  assert.ok(bs.balanced, `الميزانية متوازنة ${bs.totalAssets} vs ${bs.totalLiabilitiesAndEquity}`);

  const inv = reports.inventory(db);
  const k21 = inv.rows.find((r) => r.karat === 21);
  assert.strictEqual(k21.weight, 125);
  const invAccount = reports.accountBalances(db, {}).find((r) => r.code === '1301').balance;
  assert.strictEqual(invAccount, inv.totals.cost, 'رصيد حساب المخزون = تكلفة المخزون');

  const is = reports.incomeStatement(db, { from: '2026-09-01', to: '2026-09-30' });
  assert.strictEqual(is.cogs, 9300 - 1550);
  assert.strictEqual(is.expensesTotal, 5000);

  const vat = reports.vatReturn(db, { from: '2026-09-01', to: '2026-09-30' });
  const outVat = acc.r2(s.vat_amount - ret.vat_amount);
  assert.strictEqual(vat.totalSales.vat, outVat);
  assert.strictEqual(vat.totalPurchases.vat, acc.r2(p.vat_amount + 750));
  assert.strictEqual(vat.netVatDue, acc.r2(outVat - p.vat_amount - 750));
  const bal = reports.accountBalances(db, {});
  const vatGl = acc.r2(bal.find((r) => r.code === '2201').balance - bal.find((r) => r.code === '1401').balance);
  assert.strictEqual(vat.netVatDue, vatGl, 'الإقرار مطابق لحسابات الضريبة');

  const m = reports.monthlyReport(db, { year: 2026, month: 9 });
  assert.strictEqual(m.sales.n, 1);
  assert.strictEqual(m.byKarat.find((r) => r.karat === 21).sold, 30);

  const z = reports.zakatEstimate(db, { asOf: '2026-12-31' });
  assert.ok(z.zakat > 0);
});

test('منع البيع بأكثر من المخزون', () => {
  const db = freshDb();
  assert.throws(() => acc.createInvoice(db, { type: 'sale', lines: [{ karat: 21, weight: 1 }] }), /المخزون غير كافٍ/);
});

test('الفاتورة الضريبية B2B تتطلب رقم ضريبي للعميل', () => {
  const db = freshDb();
  acc.openingStock(db, { date: '2026-09-01', karat: 18, weight: 10, costPerGram: 200 });
  assert.throws(() => acc.createInvoice(db, { type: 'sale', subtype: 'standard', party_name: 'شركة', lines: [{ karat: 18, weight: 1 }] }), /رقم ضريبي/);
  const ok = acc.createInvoice(db, { type: 'sale', subtype: 'standard', party_name: 'شركة', party_vat: '310122393500003', lines: [{ karat: 18, weight: 1 }] });
  assert.strictEqual(ok.subtype, 'standard');
});

test('بصمة XML المعاد توليدها تطابق البصمة المخزنة', () => {
  const db = freshDb();
  acc.openingStock(db, { date: '2026-09-01', karat: 22, weight: 10, costPerGram: 330 });
  const s = acc.createInvoice(db, { type: 'sale', discount: 7.35, lines: [{ karat: 22, weight: 3.333, making_per_gram: 15 }, { karat: 22, weight: 1.1 }] });
  const xml = acc.invoiceXml(db, s.id);
  assert.strictEqual(zatca.hashXml(xml), s.invoice_hash);
  assert.match(xml, /<cbc:InvoiceTypeCode name="0200000">388<\/cbc:InvoiceTypeCode>/);
});

test('القيد غير المتوازن مرفوض', () => {
  const db = freshDb();
  assert.throws(() => acc.postJournal(db, { date: '2026-09-01', description: 'x', lines: [{ account_code: '1101', debit: 10 }, { account_code: '3101', credit: 9 }] }), /غير متوازن/);
});
