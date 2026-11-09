// A small in-memory stand-in for the Supabase query builder, enough for the code paths being replayed.
// Every query resolves on a later microtask, so concurrent callers interleave the way real requests do.
// hooks.before / hooks.after run around each query: { table, op, query } => void | Promise, and may throw
// (to play "the server stopped here") or change rows (to play another request landing in between).
//
// db.rpc(fn, args) calls db.functions[fn](db, args), a JavaScript stand-in for a database function. It
// runs as one transaction: synchronously, so no other request interleaves with it, and a throw puts
// every table back as it was. Its hooks see { table: null, op: 'rpc', fn, args }. Inside a function,
// db.step(name) runs the synchronous hooks.inside, which may throw to play the server stopping midway.
// A thrown error with a `code` comes back as { error: { code, message } }, like PostgREST's.
import { randomUUID } from 'node:crypto'

export function createFakeDb({ tables = {}, unique = {} } = {}) {
  const db = { tables, unique, functions: {}, hooks: { before: [], after: [], inside: [] }, log: [] }
  for (const name of Object.keys(unique)) db.tables[name] ??= []
  db.from = (table) => new Query(db, table)
  db.rpc = (fn, args = {}) => new Rpc(db, fn, args)
  db.rows = (table) => (db.tables[table] ??= [])
  db.step = (name) => { for (const hook of db.hooks.inside) hook(name) }
  return db
}

class Rpc {
  constructor(db, fn, args) { Object.assign(this, { db, fn, args }) }
  then(resolve, reject) { return this.run().then(resolve, reject) }

  async run() {
    await Promise.resolve()
    const event = { table: null, op: 'rpc', fn: this.fn, args: this.args, query: this }
    for (const hook of this.db.hooks.before) await hook(event)
    const result = this.execute()
    this.db.log.push({ table: null, op: 'rpc', fn: this.fn, ok: !result.error })
    for (const hook of this.db.hooks.after) await hook({ ...event, result })
    await Promise.resolve()
    return result
  }

  execute() {
    const impl = this.db.functions[this.fn]
    if (!impl) throw new Error(`fake db: no function ${this.fn}`)
    const saved = structuredClone(this.db.tables)
    try {
      return { data: impl(this.db, this.args), error: null }
    } catch (err) {
      for (const name of Object.keys(this.db.tables)) if (!(name in saved)) delete this.db.tables[name]
      Object.assign(this.db.tables, saved)
      if (err.code) return { data: null, error: { code: err.code, message: err.message } }
      throw err
    }
  }
}

class Query {
  constructor(db, table) {
    Object.assign(this, { db, table, op: 'select', filters: [], returning: false, mode: null, rangeArgs: null, limitN: null })
  }
  select() { if (this.op !== 'select') this.returning = true; return this }
  insert(rows) { this.op = 'insert'; this.payload = [rows].flat(); return this }
  update(values) { this.op = 'update'; this.payload = values; return this }
  upsert(rows, opts = {}) { this.op = 'upsert'; this.payload = [rows].flat(); this.conflict = (opts.onConflict || 'id').split(','); return this }
  delete() { this.op = 'delete'; return this }
  eq(k, v) { this.filters.push((r) => r[k] === v); return this }
  neq(k, v) { this.filters.push((r) => r[k] !== v); return this }
  in(k, vs) { this.filters.push((r) => vs.includes(r[k])); return this }
  is(k, v) { this.filters.push((r) => (r[k] ?? null) === v); return this }
  ilike(k, v) { this.filters.push((r) => String(r[k] ?? '').toLowerCase() === String(v).toLowerCase()); return this }
  not(k, op, v) {
    if (op !== 'is') throw new Error(`fake db: unsupported not(${op})`)
    this.filters.push((r) => (r[k] ?? null) !== v)
    return this
  }
  range(a, b) { this.rangeArgs = [a, b]; return this }
  limit(n) { this.limitN = n; return this }
  order(k, { ascending = true } = {}) { this.sortBy = { k, dir: ascending ? 1 : -1 }; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  then(resolve, reject) { return this.run().then(resolve, reject) }

  async run() {
    await Promise.resolve()
    for (const hook of this.db.hooks.before) await hook({ table: this.table, op: this.op, query: this })
    const result = this.execute()
    this.db.log.push({ table: this.table, op: this.op, ok: !result.error })
    for (const hook of this.db.hooks.after) await hook({ table: this.table, op: this.op, query: this, result })
    await Promise.resolve()
    return result
  }

  execute() {
    const rows = this.db.rows(this.table)
    const match = (r) => this.filters.every((f) => f(r))
    const shape = (list) => {
      if (this.mode === 'single') return list.length === 1 ? { data: list[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } }
      if (this.mode === 'maybe') return { data: list[0] ?? null, error: null }
      return { data: list, error: null }
    }
    const copy = (r) => structuredClone(r)
    if (this.op === 'select') {
      let list = rows.filter(match)
      if (this.sortBy) {
        const { k, dir } = this.sortBy
        list = [...list].sort((a, b) => (a[k] < b[k] ? -dir : a[k] > b[k] ? dir : 0))
      }
      if (this.rangeArgs) list = list.slice(this.rangeArgs[0], this.rangeArgs[1] + 1)
      if (this.limitN != null) list = list.slice(0, this.limitN)
      return shape(list.map(copy))
    }
    if (this.op === 'insert') {
      for (const row of this.payload)
        for (const cols of this.db.unique[this.table] || [])
          if (rows.some((r) => cols.every((c) => r[c] === row[c])))
            return { data: null, error: { code: '23505', message: `duplicate key on ${cols.join(',')}` } }
      const added = this.payload.map((row) => ({ id: randomUUID(), ...copy(row) }))
      rows.push(...added)
      return this.returning ? shape(added.map(copy)) : { data: null, error: null }
    }
    if (this.op === 'upsert') {
      const out = []
      for (const row of this.payload) {
        const hit = rows.find((r) => this.conflict.every((c) => r[c] === row[c]))
        if (hit) Object.assign(hit, copy(row)), out.push(hit)
        else { const added = { id: randomUUID(), ...copy(row) }; rows.push(added); out.push(added) }
      }
      return this.returning ? shape(out.map(copy)) : { data: null, error: null }
    }
    if (this.op === 'update') {
      const hit = rows.filter(match)
      for (const r of hit) Object.assign(r, copy(this.payload))
      return this.returning ? shape(hit.map(copy)) : { data: null, error: null }
    }
    if (this.op === 'delete') {
      const keep = rows.filter((r) => !match(r))
      rows.length = 0
      rows.push(...keep)
      return { data: null, error: null }
    }
    throw new Error(`fake db: unsupported op ${this.op}`)
  }
}
