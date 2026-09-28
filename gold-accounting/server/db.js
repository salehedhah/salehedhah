'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','accountant','cashier')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- دليل الحسابات
CREATE TABLE IF NOT EXISTS accounts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  current INTEGER NOT NULL DEFAULT 1,
  system INTEGER NOT NULL DEFAULT 0
);

-- العملاء والموردون
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('customer','supplier')),
  name TEXT NOT NULL,
  vat_number TEXT,
  cr_number TEXT,
  phone TEXT,
  id_number TEXT,
  address TEXT,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الفواتير: مبيعات، مشتريات، مردودات
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale','purchase','sale_return','purchase_return')),
  subtype TEXT NOT NULL DEFAULT 'simplified' CHECK (subtype IN ('standard','simplified')),
  date TEXT NOT NULL,
  party_id INTEGER REFERENCES parties(id),
  party_name TEXT,
  party_vat TEXT,
  purchase_source TEXT CHECK (purchase_source IN ('vat_supplier','individual','zero_rated')),
  original_invoice_id INTEGER REFERENCES invoices(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','bank','card','credit')),
  gold_value REAL NOT NULL DEFAULT 0,
  making_value REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  cost_of_goods REAL NOT NULL DEFAULT 0,
  notes TEXT,
  -- حقول الفوترة الإلكترونية (فاتورة)
  uuid TEXT NOT NULL,
  icv INTEGER,
  invoice_hash TEXT,
  previous_hash TEXT,
  qr_tlv TEXT,
  zatca_status TEXT NOT NULL DEFAULT 'not_submitted',
  zatca_response TEXT,
  journal_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('jewelry','investment')),
  karat INTEGER NOT NULL CHECK (karat IN (24,22,21,18)),
  weight REAL NOT NULL,
  price_per_gram REAL NOT NULL,
  making_per_gram REAL NOT NULL DEFAULT 0,
  gold_value REAL NOT NULL,
  making_value REAL NOT NULL,
  line_subtotal REAL NOT NULL,
  vat_rate REAL NOT NULL,
  vat_amount REAL NOT NULL,
  line_total REAL NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0
);

-- حركة مخزون الذهب بالوزن لكل عيار
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  karat INTEGER NOT NULL,
  weight REAL NOT NULL,            -- موجب = وارد، سالب = صادر
  cost REAL NOT NULL,              -- موجب/سالب بنفس الإشارة
  ref_type TEXT NOT NULL,
  ref_id INTEGER,
  note TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  account_code TEXT NOT NULL REFERENCES accounts(code),
  description TEXT NOT NULL,
  supplier_name TEXT,
  supplier_vat TEXT,
  amount REAL NOT NULL,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  journal_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- قيود اليومية (قيد مزدوج)
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  ref_type TEXT NOT NULL DEFAULT 'manual',
  ref_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL REFERENCES accounts(code),
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  memo TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_code);
CREATE INDEX IF NOT EXISTS idx_stock_karat ON stock_moves(karat);
`;

// دليل الحسابات الافتراضي لمحل ذهب
const DEFAULT_ACCOUNTS = [
  ['1101', 'الصندوق (نقدية)', 'asset', 1],
  ['1102', 'البنك', 'asset', 1],
  ['1103', 'مدى / نقاط البيع', 'asset', 1],
  ['1201', 'العملاء (ذمم مدينة)', 'asset', 1],
  ['1301', 'مخزون الذهب', 'asset', 1],
  ['1401', 'ضريبة القيمة المضافة - مدخلات', 'asset', 1],
  ['1501', 'الأثاث والتجهيزات', 'asset', 0],
  ['1502', 'مجمع الإهلاك', 'asset', 0],
  ['2101', 'الموردون (ذمم دائنة)', 'liability', 1],
  ['2201', 'ضريبة القيمة المضافة - مخرجات', 'liability', 1],
  ['2202', 'ضريبة القيمة المضافة - تسوية مستحقة', 'liability', 1],
  ['2301', 'الزكاة المستحقة', 'liability', 1],
  ['2401', 'مصروفات مستحقة', 'liability', 1],
  ['3101', 'رأس المال', 'equity', 0],
  ['3201', 'الأرباح المبقاة', 'equity', 0],
  ['3301', 'جاري المالك', 'equity', 0],
  ['4101', 'مبيعات الذهب', 'revenue', 0],
  ['4102', 'إيرادات المصنعية', 'revenue', 0],
  ['4201', 'مردودات المبيعات', 'revenue', 0],
  ['4301', 'إيرادات أخرى', 'revenue', 0],
  ['5101', 'تكلفة الذهب المباع', 'expense', 0],
  ['6101', 'الرواتب والأجور', 'expense', 0],
  ['6102', 'الإيجار', 'expense', 0],
  ['6103', 'الكهرباء والمياه والاتصالات', 'expense', 0],
  ['6104', 'مصروفات عمومية وإدارية', 'expense', 0],
  ['6105', 'رسوم حكومية', 'expense', 0],
  ['6106', 'مصروف الإهلاك', 'expense', 0],
  ['6107', 'عمولات بنكية ونقاط البيع', 'expense', 0],
  ['6201', 'مصروف الزكاة', 'expense', 0],
];

const DEFAULT_SETTINGS = {
  company_name: 'محل الذهب',
  company_name_en: 'Gold Shop',
  vat_number: '',
  cr_number: '',
  address_street: '',
  address_building: '',
  address_district: '',
  address_city: 'الرياض',
  address_postal: '',
  phone: '',
  vat_rate: '15',
  gold_price_24: '0',
  default_making_per_gram: '0',
  invoice_prefix_sale: 'INV',
  invoice_prefix_purchase: 'PUR',
  invoice_prefix_sale_return: 'CRN',
  invoice_prefix_purchase_return: 'DBN',
  zatca_env: 'sandbox',
  zatca_csid: '',
  zatca_secret: '',
  zatca_private_key: '',
  zatca_last_icv: '0',
  zatca_last_hash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
};

function openDb(file) {
  let dbFile = file;
  if (!dbFile) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbFile = path.join(DATA_DIR, 'gold.db');
  }
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  const insAcc = db.prepare('INSERT OR IGNORE INTO accounts (code, name, type, current, system) VALUES (?, ?, ?, ?, 1)');
  const insSet = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const a of DEFAULT_ACCOUNTS) insAcc.run(...a);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSet.run(k, v);
  })();
  return db;
}

function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function setSettings(db, obj) {
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(obj)) up.run(k, v == null ? '' : String(v));
  })();
}

module.exports = { openDb, getSettings, setSettings, DEFAULT_ACCOUNTS };
