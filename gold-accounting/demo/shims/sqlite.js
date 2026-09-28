'use strict';
// واجهة مطابقة لـ better-sqlite3 فوق sql.js (للنسخة التجريبية في المتصفح)
function bindArgs(args) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const o = {};
    for (const [k, v] of Object.entries(args[0])) o['@' + k] = v === undefined ? null : v;
    return o;
  }
  return args.flat().map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
}

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; }
  _stmt(args) { const s = this.db._raw.prepare(this.sql); const b = bindArgs(args); if (Array.isArray(b) ? b.length : true) s.bind(b); return s; }
  get(...args) { const s = this._stmt(args); try { return s.step() ? s.getAsObject() : undefined; } finally { s.free(); } }
  all(...args) { const s = this._stmt(args); const out = []; try { while (s.step()) out.push(s.getAsObject()); return out; } finally { s.free(); } }
  run(...args) {
    const s = this._stmt(args);
    try { s.step(); } finally { s.free(); }
    const changes = this.db._raw.getRowsModified();
    const id = this.db._raw.exec('SELECT last_insert_rowid()')[0].values[0][0];
    this.db._dirty = true;
    return { changes, lastInsertRowid: id };
  }
}

class Database {
  constructor() {
    if (!globalThis.__SQL_DB__) throw new Error('sql.js not initialised');
    this._depth = 0;
    this._dirty = false;
  }
  get _raw() { return globalThis.__SQL_DB__; }
  prepare(sql) { return new Statement(this, sql); }
  exec(sql) { this._raw.exec(sql); this._dirty = true; return this; }
  pragma(p) { try { this._raw.exec('PRAGMA ' + p); } catch (e) { /* غير مدعوم */ } }
  transaction(fn) {
    return (...args) => {
      const sp = 'sp' + this._depth;
      this._raw.exec(this._depth ? `SAVEPOINT ${sp}` : 'BEGIN');
      this._depth++;
      try {
        const r = fn(...args);
        this._depth--;
        this._raw.exec(this._depth ? `RELEASE ${sp}` : 'COMMIT');
        return r;
      } catch (e) {
        this._depth--;
        this._raw.exec(this._depth ? `ROLLBACK TO ${sp}; RELEASE ${sp}` : 'ROLLBACK');
        throw e;
      }
    };
  }
  async backup() { throw new Error('النسخ الاحتياطي غير متاح في النسخة التجريبية'); }
}
module.exports = Database;
