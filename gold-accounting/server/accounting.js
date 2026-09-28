'use strict';
const crypto = require('crypto');
const { getSettings, setSettings } = require('./db');
const zatca = require('./zatca');

const KARATS = [24, 22, 21, 18];
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

class ValidationError extends Error {
  constructor(msg) { super(msg); this.status = 400; }
}

const PAYMENT_ACCOUNTS = { cash: '1101', bank: '1102', card: '1103' };

function paymentAccount(method, type) {
  if (method === 'credit') return type === 'sale' || type === 'sale_return' ? '1201' : '2101';
  const acc = PAYMENT_ACCOUNTS[method];
  if (!acc) throw new ValidationError('طريقة دفع غير صحيحة');
  return acc;
}

/** سعر الجرام لعيار معين بناءً على سعر عيار 24 */
function karatPrice(price24, karat) {
  return r2((Number(price24) * karat) / 24);
}

// ---------------- القيود ----------------

function postJournal(db, { date, description, refType = 'manual', refId = null, lines, userId = null }) {
  const clean = lines
    .map((l) => ({ account_code: l.account_code, debit: r2(l.debit || 0), credit: r2(l.credit || 0), memo: l.memo || null }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  if (clean.length < 2) throw new ValidationError('القيد يجب أن يحتوي على طرفين على الأقل');
  const dr = r2(clean.reduce((s, l) => s + l.debit, 0));
  const cr = r2(clean.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(dr - cr) > 0.009) throw new ValidationError(`القيد غير متوازن: مدين ${dr} / دائن ${cr}`);
  const accExists = db.prepare('SELECT 1 FROM accounts WHERE code = ?');
  for (const l of clean) {
    if (!accExists.get(l.account_code)) throw new ValidationError(`الحساب ${l.account_code} غير موجود`);
    if (l.debit < 0 || l.credit < 0) throw new ValidationError('لا يسمح بمبالغ سالبة في القيد');
  }
  const info = db.prepare('INSERT INTO journal_entries (date, description, ref_type, ref_id, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(date, description, refType, refId, userId);
  const ins = db.prepare('INSERT INTO journal_lines (entry_id, account_code, debit, credit, memo) VALUES (?, ?, ?, ?, ?)');
  for (const l of clean) ins.run(info.lastInsertRowid, l.account_code, l.debit, l.credit, l.memo);
  return Number(info.lastInsertRowid);
}

// ---------------- المخزون ----------------

function stockOf(db, karat) {
  const row = db.prepare('SELECT COALESCE(SUM(weight),0) w, COALESCE(SUM(cost),0) c FROM stock_moves WHERE karat = ?').get(karat);
  const weight = r3(row.w);
  const cost = r2(row.c);
  return { karat, weight, cost, avgCost: weight > 0 ? cost / weight : 0 };
}

function addStockMove(db, { date, karat, weight, cost, refType, refId, note }) {
  db.prepare('INSERT INTO stock_moves (date, karat, weight, cost, ref_type, ref_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(date, karat, r3(weight), r2(cost), refType, refId, note || null);
}

/** رصيد افتتاحي للمخزون: مدين المخزون / دائن رأس المال */
function openingStock(db, { date, karat, weight, costPerGram, userId }) {
  karat = Number(karat);
  if (!KARATS.includes(karat)) throw new ValidationError('عيار غير صحيح');
  weight = r3(weight);
  if (!(weight > 0)) throw new ValidationError('الوزن يجب أن يكون أكبر من صفر');
  const cost = r2(weight * Number(costPerGram));
  if (!(cost > 0)) throw new ValidationError('التكلفة يجب أن تكون أكبر من صفر');
  return db.transaction(() => {
    const jid = postJournal(db, {
      date, description: `رصيد افتتاحي مخزون عيار ${karat} - ${weight} جم`, refType: 'opening_stock', userId,
      lines: [{ account_code: '1301', debit: cost }, { account_code: '3101', credit: cost }],
    });
    addStockMove(db, { date, karat, weight, cost, refType: 'opening_stock', refId: jid, note: 'رصيد افتتاحي' });
    return jid;
  })();
}

// ---------------- الفواتير ----------------

function nextNumber(db, type, settings, date) {
  const prefix = settings[`invoice_prefix_${type}`] || type.toUpperCase();
  const year = String(date).slice(0, 4);
  const like = `${prefix}-${year}-%`;
  const row = db.prepare('SELECT number FROM invoices WHERE number LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const seq = row ? Number(row.number.split('-').pop()) + 1 : 1;
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * يحسب بنود الفاتورة والضريبة.
 * - المشغولات الذهبية: خاضعة للنسبة الأساسية 15% (شاملة المصنعية).
 * - الذهب الاستثماري (نقاوة 99% فأكثر - سبائك وجنيهات): نسبة صفرية.
 * - الشراء من الأفراد غير المسجلين (ذهب مستعمل/كسر): لا ضريبة مدخلات.
 */
function computeInvoice({ type, lines, discount = 0, purchaseSource, settings }) {
  if (!Array.isArray(lines) || lines.length === 0) throw new ValidationError('الفاتورة يجب أن تحتوي على بند واحد على الأقل');
  const stdRate = Number(settings.vat_rate || 15);
  const price24 = Number(settings.gold_price_24 || 0);
  const isPurchase = type === 'purchase' || type === 'purchase_return';

  const out = lines.map((l, i) => {
    const karat = Number(l.karat);
    if (!KARATS.includes(karat)) throw new ValidationError(`البند ${i + 1}: عيار غير صحيح`);
    const weight = r3(l.weight);
    if (!(weight > 0)) throw new ValidationError(`البند ${i + 1}: الوزن يجب أن يكون أكبر من صفر`);
    const category = l.category === 'investment' ? 'investment' : 'jewelry';
    const pricePerGram = l.price_per_gram != null && l.price_per_gram !== '' ? Number(l.price_per_gram) : karatPrice(price24, karat);
    if (!(pricePerGram > 0)) throw new ValidationError(`البند ${i + 1}: سعر الجرام غير محدد (حدّث سعر الذهب في الإعدادات)`);
    const makingPerGram = Number(l.making_per_gram || 0);
    if (makingPerGram < 0) throw new ValidationError(`البند ${i + 1}: المصنعية لا يمكن أن تكون سالبة`);
    const goldValue = r2(weight * pricePerGram);
    const makingValue = r2(weight * makingPerGram);
    let vatRate = category === 'investment' ? 0 : stdRate;
    if (isPurchase && (purchaseSource === 'individual' || purchaseSource === 'zero_rated')) vatRate = 0;
    return {
      description: String(l.description || (category === 'investment' ? 'ذهب استثماري' : 'مشغولات ذهبية')).slice(0, 200),
      category, karat, weight,
      price_per_gram: r2(pricePerGram),
      making_per_gram: r2(makingPerGram),
      gold_value: goldValue,
      making_value: makingValue,
      line_subtotal: r2(goldValue + makingValue),
      vat_rate: vatRate,
    };
  });

  const subtotal = r2(out.reduce((s, l) => s + l.line_subtotal, 0));
  discount = r2(discount || 0);
  if (discount < 0 || discount > subtotal) throw new ValidationError('الخصم غير صحيح');

  // توزيع الخصم على البنود نسبياً لاحتساب الضريبة بدقة
  let allocated = 0;
  out.forEach((l, i) => {
    const share = i === out.length - 1 ? r2(discount - allocated) : r2(subtotal ? (discount * l.line_subtotal) / subtotal : 0);
    allocated = r2(allocated + share);
    l.discount_share = share;
    l.vat_amount = r2(((l.line_subtotal - share) * l.vat_rate) / 100);
    l.line_total = r2(l.line_subtotal - share + l.vat_amount);
  });

  const goldValue = r2(out.reduce((s, l) => s + l.gold_value, 0));
  const makingValue = r2(out.reduce((s, l) => s + l.making_value, 0));
  const taxable = r2(subtotal - discount);
  const vat = r2(out.reduce((s, l) => s + l.vat_amount, 0));
  return { lines: out, goldValue, makingValue, subtotal, discount, taxable, vat, total: r2(taxable + vat) };
}

function createInvoice(db, input, userId) {
  const type = input.type;
  if (!['sale', 'purchase', 'sale_return', 'purchase_return'].includes(type)) throw new ValidationError('نوع الفاتورة غير صحيح');
  const settings = getSettings(db);
  const date = input.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError('التاريخ غير صحيح');
  const paymentMethod = input.payment_method || 'cash';
  const isSaleSide = type === 'sale' || type === 'sale_return';
  const purchaseSource = isSaleSide ? null : (input.purchase_source || 'vat_supplier');

  let party = null;
  if (input.party_id) {
    party = db.prepare('SELECT * FROM parties WHERE id = ?').get(input.party_id);
    if (!party) throw new ValidationError('العميل/المورد غير موجود');
  }
  const partyName = (party && party.name) || input.party_name || null;
  const partyVat = (party && party.vat_number) || input.party_vat || null;
  const subtype = isSaleSide && input.subtype === 'standard' ? 'standard' : 'simplified';
  if (subtype === 'standard' && !zatca.isValidVatNumber(partyVat)) {
    throw new ValidationError('الفاتورة الضريبية (B2B) تتطلب رقم ضريبي صحيح للعميل (15 رقم يبدأ وينتهي بـ 3)');
  }
  if (paymentMethod === 'credit' && !party) throw new ValidationError('البيع/الشراء الآجل يتطلب اختيار عميل أو مورد');

  let original = null;
  if (type.endsWith('_return') && input.original_invoice_id) {
    original = db.prepare('SELECT * FROM invoices WHERE id = ?').get(input.original_invoice_id);
    const expected = type === 'sale_return' ? 'sale' : 'purchase';
    if (!original || original.type !== expected) throw new ValidationError('الفاتورة الأصلية غير صحيحة');
  }

  const calc = computeInvoice({ type, lines: input.lines, discount: input.discount, purchaseSource, settings });

  return db.transaction(() => {
    const number = nextNumber(db, type, settings, date);
    const uuid = crypto.randomUUID();

    // تكلفة البضاعة وحركة المخزون
    let cogs = 0;
    for (const l of calc.lines) {
      if (type === 'sale') {
        const st = stockOf(db, l.karat);
        if (st.weight + 1e-9 < l.weight) {
          throw new ValidationError(`المخزون غير كافٍ لعيار ${l.karat}: المتوفر ${st.weight} جم والمطلوب ${l.weight} جم`);
        }
        l.unit_cost = st.weight > 0 ? st.cost / st.weight : 0;
        l.cost = r2(l.weight * l.unit_cost);
        // حماية من فروقات التقريب عند بيع كامل الرصيد
        if (Math.abs(st.weight - l.weight) < 1e-9) l.cost = st.cost;
      } else if (type === 'sale_return') {
        let unit = null;
        if (original) {
          const ol = db.prepare('SELECT unit_cost FROM invoice_lines WHERE invoice_id = ? AND karat = ? LIMIT 1').get(original.id, l.karat);
          if (ol) unit = ol.unit_cost;
        }
        if (unit == null) unit = stockOf(db, l.karat).avgCost;
        l.unit_cost = unit;
        l.cost = r2(l.weight * unit);
      } else if (type === 'purchase') {
        const net = l.line_subtotal - l.discount_share;
        l.unit_cost = net / l.weight;
        l.cost = r2(net);
      } else {
        const st = stockOf(db, l.karat);
        if (st.weight + 1e-9 < l.weight) throw new ValidationError(`المخزون غير كافٍ لإرجاع عيار ${l.karat}`);
        const net = l.line_subtotal - l.discount_share;
        l.unit_cost = net / l.weight;
        l.cost = r2(net);
      }
      cogs = r2(cogs + l.cost);
    }

    const invInfo = db.prepare(`INSERT INTO invoices
      (number, type, subtype, date, party_id, party_name, party_vat, purchase_source, original_invoice_id, payment_method,
       gold_value, making_value, subtotal, discount, taxable_amount, vat_amount, total, cost_of_goods, notes, uuid, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      number, type, subtype, date, party ? party.id : null, partyName, partyVat, purchaseSource, original ? original.id : null,
      paymentMethod, calc.goldValue, calc.makingValue, calc.subtotal, calc.discount, calc.taxable, calc.vat, calc.total,
      type.startsWith('sale') ? cogs : 0, input.notes || null, uuid, userId || null);
    const invoiceId = Number(invInfo.lastInsertRowid);

    const insLine = db.prepare(`INSERT INTO invoice_lines
      (invoice_id, description, category, karat, weight, price_per_gram, making_per_gram, gold_value, making_value,
       line_subtotal, vat_rate, vat_amount, line_total, unit_cost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const l of calc.lines) {
      insLine.run(invoiceId, l.description, l.category, l.karat, l.weight, l.price_per_gram, l.making_per_gram,
        l.gold_value, l.making_value, l.line_subtotal, l.vat_rate, l.vat_amount, l.line_total, l.unit_cost);
      const sign = type === 'sale' || type === 'purchase_return' ? -1 : 1;
      addStockMove(db, { date, karat: l.karat, weight: sign * l.weight, cost: sign * l.cost, refType: type, refId: invoiceId, note: number });
    }

    // القيد المحاسبي
    const payAcc = paymentAccount(paymentMethod, type);
    const goldNet = r2(calc.goldValue - calc.discount);
    let lines;
    let desc;
    if (type === 'sale') {
      desc = `فاتورة مبيعات ${number}${partyName ? ' - ' + partyName : ''}`;
      lines = [
        { account_code: payAcc, debit: calc.total },
        { account_code: '4101', credit: goldNet },
        { account_code: '4102', credit: calc.makingValue },
        { account_code: '2201', credit: calc.vat },
        { account_code: '5101', debit: cogs },
        { account_code: '1301', credit: cogs },
      ];
      // في حال كان الخصم أكبر من قيمة الذهب يُحمّل الباقي على المصنعية
      if (goldNet < 0) { lines[1].credit = 0; lines[2].credit = r2(calc.makingValue + goldNet); }
    } else if (type === 'sale_return') {
      desc = `إشعار دائن (مرتجع مبيعات) ${number}${original ? ' عن ' + original.number : ''}`;
      lines = [
        { account_code: '4201', debit: calc.taxable },
        { account_code: '2201', debit: calc.vat },
        { account_code: payAcc, credit: calc.total },
        { account_code: '1301', debit: cogs },
        { account_code: '5101', credit: cogs },
      ];
    } else if (type === 'purchase') {
      desc = `فاتورة مشتريات ${number}${partyName ? ' - ' + partyName : ''}`;
      lines = [
        { account_code: '1301', debit: cogs },
        { account_code: '1401', debit: calc.vat },
        { account_code: payAcc, credit: calc.total },
      ];
    } else {
      desc = `إشعار مدين (مرتجع مشتريات) ${number}${original ? ' عن ' + original.number : ''}`;
      lines = [
        { account_code: payAcc, debit: calc.total },
        { account_code: '1301', credit: cogs },
        { account_code: '1401', credit: calc.vat },
      ];
    }
    const journalId = postJournal(db, { date, description: desc, refType: 'invoice', refId: invoiceId, lines, userId });

    // الفوترة الإلكترونية لفواتير البيع والإشعارات الدائنة
    const upd = { journal_id: journalId, icv: null, invoice_hash: null, previous_hash: null, qr_tlv: null };
    if (isSaleSide) {
      const icv = Number(settings.zatca_last_icv || 0) + 1;
      const previousHash = settings.zatca_last_hash;
      const invoiceRow = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
      Object.assign(invoiceRow, { icv, previous_hash: previousHash });
      const xml = zatca.buildInvoiceXml({ invoice: invoiceRow, lines: calc.lines, settings, originalNumber: original && original.number });
      const hash = zatca.hashXml(xml);
      const timestamp = `${date}T${String(invoiceRow.created_at).slice(11, 19) || '00:00:00'}`;
      const qr = zatca.buildQrTlv({
        sellerName: settings.company_name,
        vatNumber: settings.vat_number || '',
        timestamp,
        total: type === 'sale_return' ? -calc.total : calc.total,
        vatTotal: type === 'sale_return' ? -calc.vat : calc.vat,
      });
      Object.assign(upd, { icv, invoice_hash: hash, previous_hash: previousHash, qr_tlv: qr });
      setSettings(db, { zatca_last_icv: icv, zatca_last_hash: hash });
    }
    db.prepare('UPDATE invoices SET journal_id=@journal_id, icv=@icv, invoice_hash=@invoice_hash, previous_hash=@previous_hash, qr_tlv=@qr_tlv WHERE id=@id')
      .run({ ...upd, id: invoiceId });

    db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)').run(userId || null, 'invoice.create', number);
    return getInvoice(db, invoiceId);
  })();
}

function getInvoice(db, id) {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return null;
  inv.lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id').all(id);
  if (inv.original_invoice_id) {
    const o = db.prepare('SELECT number FROM invoices WHERE id = ?').get(inv.original_invoice_id);
    inv.original_number = o && o.number;
  }
  return inv;
}

function invoiceXml(db, id) {
  const inv = getInvoice(db, id);
  if (!inv || !inv.icv) return null;
  const settings = getSettings(db);
  // إعادة بناء حصص الخصم للبنود
  let allocated = 0;
  inv.lines.forEach((l, i) => {
    const share = i === inv.lines.length - 1 ? r2(inv.discount - allocated) : r2(inv.subtotal ? (inv.discount * l.line_subtotal) / inv.subtotal : 0);
    allocated = r2(allocated + share);
    l.discount_share = share;
  });
  return zatca.buildInvoiceXml({ invoice: inv, lines: inv.lines, settings, originalNumber: inv.original_number });
}

// ---------------- المصروفات ----------------

function createExpense(db, input, userId) {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const acc = db.prepare("SELECT * FROM accounts WHERE code = ? AND type = 'expense'").get(input.account_code);
  if (!acc) throw new ValidationError('حساب المصروف غير صحيح');
  const amount = r2(input.amount);
  if (!(amount > 0)) throw new ValidationError('المبلغ يجب أن يكون أكبر من صفر');
  const vat = r2(input.vat_amount || 0);
  if (vat < 0) throw new ValidationError('الضريبة لا يمكن أن تكون سالبة');
  if (vat > 0 && input.supplier_vat && !zatca.isValidVatNumber(input.supplier_vat)) throw new ValidationError('الرقم الضريبي للمورد غير صحيح');
  const total = r2(amount + vat);
  const method = input.payment_method || 'cash';
  const payAcc = method === 'credit' ? '2401' : paymentAccount(method, 'expense');
  if (!input.description) throw new ValidationError('وصف المصروف مطلوب');
  return db.transaction(() => {
    const info = db.prepare(`INSERT INTO expenses (date, account_code, description, supplier_name, supplier_vat, amount, vat_amount, total, payment_method, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(date, acc.code, input.description, input.supplier_name || null, input.supplier_vat || null, amount, vat, total, method, userId || null);
    const id = Number(info.lastInsertRowid);
    const jid = postJournal(db, {
      date, description: `مصروف: ${input.description}`, refType: 'expense', refId: id, userId,
      lines: [{ account_code: acc.code, debit: amount }, { account_code: '1401', debit: vat }, { account_code: payAcc, credit: total }],
    });
    db.prepare('UPDATE expenses SET journal_id = ? WHERE id = ?').run(jid, id);
    return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  })();
}

function deleteExpense(db, id) {
  const e = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  if (!e) throw new ValidationError('المصروف غير موجود');
  db.transaction(() => {
    if (e.journal_id) db.prepare('DELETE FROM journal_entries WHERE id = ?').run(e.journal_id);
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  })();
}

module.exports = {
  KARATS, r2, r3, ValidationError, karatPrice,
  postJournal, stockOf, openingStock,
  computeInvoice, createInvoice, getInvoice, invoiceXml,
  createExpense, deleteExpense,
};
