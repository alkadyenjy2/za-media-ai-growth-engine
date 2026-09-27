import { convex } from './convex'
import { api } from '../../convex/_generated/api'

export const backendConfigured = true

type Row = Record<string, any>

class QueryBuilder implements PromiseLike<any> {
  private filters: Array<(row: Row) => boolean> = []
  private sort: { column: string; ascending: boolean } | null = null
  private maxRows: number | null = null
  private op: 'select'|'insert'|'update'|'delete' = 'select'
  private payload: any = null

  private countMode = false
  private head = false

  constructor(private table: string) {}

  select(_columns = '*', options?: { count?: 'exact'; head?: boolean }) {

    this.countMode = options?.count === 'exact'
    this.head = options?.head === true
    return this
  }
  eq(column: string, value: any) { this.filters.push(row => row[column] === value); return this }
  neq(column: string, value: any) { this.filters.push(row => row[column] !== value); return this }
  in(column: string, values: any[]) { this.filters.push(row => values.includes(row[column])); return this }
  gte(column: string, value: any) { this.filters.push(row => row[column] >= value); return this }
  lte(column: string, value: any) { this.filters.push(row => row[column] <= value); return this }
  ilike(column: string, value: string) { const needle=value.replace(/%/g,'').toLowerCase(); this.filters.push(row => String(row[column] ?? '').toLowerCase().includes(needle)); return this }
  order(column: string, options?: { ascending?: boolean }) { this.sort={column,ascending:options?.ascending!==false}; return this }
  limit(value: number) { this.maxRows=value; return this }
  range(from: number, to: number) { this.filters.push((row: Row) => { void row; return true }); this.maxRows=to-from+1; return this }
  insert(data: any) { this.op='insert'; this.payload=data; return this }
  update(data: any) { this.op='update'; this.payload=data; return this }
  delete() { this.op='delete'; return this }
  single() { return this }
  maybeSingle() { return this }

  async then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    try { return resolve(await this.execute()) } catch (error) { if (reject) return reject(error); throw error }
  }

  private async execute() {
    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      const created: Row[] = []
      for (const item of items) created.push(await convex.mutation(api.core.insert, { table: this.table as any, data: item }))
      return { data: Array.isArray(this.payload) ? created : created[0] ?? null, error: null, count: created.length }
    }
    if (this.op === 'update') {
      const base = await convex.query(api.core.list, { table: this.table as any, limit: 500 })
      const matches = base.filter((row: Row) => this.filters.every(fn => fn(row)))
      const updated = []
      for (const row of matches) updated.push(await convex.mutation(api.core.update, { table: this.table as any, id: String(row._id), data: this.payload }))
      return { data: updated.length === 1 ? updated[0] : updated, error: null, count: updated.length }
    }
    if (this.op === 'delete') {
      const base = await convex.query(api.core.list, { table: this.table as any, limit: 500 })
      const matches = base.filter((row: Row) => this.filters.every(fn => fn(row)))
      for (const row of matches) await convex.mutation(api.core.remove, { table: this.table as any, id: String(row._id) })
      return { data: null, error: null, count: matches.length }
    }

    let rows: Row[] = await convex.query(api.core.list, { table: this.table as any, limit: 500 })
    for (const filter of this.filters) rows = rows.filter(filter)
    if (this.sort) rows.sort((a,b) => {
      const av=a[this.sort!.column] ?? ''; const bv=b[this.sort!.column] ?? ''
      const cmp=av===bv?0:av>bv?1:-1
      return this.sort!.ascending?cmp:-cmp
    })
    if (this.maxRows !== null) rows=rows.slice(0,this.maxRows)
    rows=await this.hydrate(rows)
    if (this.head) return { data: null, error: null, count: rows.length }
    return { data: rows, error: null, count: this.countMode ? rows.length : null }
  }

  private async hydrate(rows: Row[]) {
    if (this.table === 'leads') {
      const [companies,contacts]=await Promise.all([
        convex.query(api.core.list,{table:'companies',limit:500}),
        convex.query(api.core.list,{table:'contacts',limit:500}),
      ])
      return rows.map(row=>({...row, id:String(row._id), companies:companies.find((c:any)=>String(c._id)===String(row.company_id))??null, contacts:contacts.find((c:any)=>String(c._id)===String(row.contact_id))??null}))
    }
    if (this.table === 'campaigns') {
      const companies=await convex.query(api.core.list,{table:'companies',limit:500})
      return rows.map(row=>({...row,id:String(row._id),companies:companies.find((c:any)=>String(c._id)===String(row.company_id))??null}))
    }
    if (this.table === 'conversations') {
      const leads=await convex.query(api.core.list,{table:'leads',limit:500})
      return rows.map(row=>({...row,id:String(row._id),leads:leads.find((l:any)=>String(l._id)===String(row.lead_id))??null}))
    }
    return rows.map(row=>({...row,id:String(row._id)}))
  }
}

export const dataClient = {
  from: (table: string) => new QueryBuilder(table),
  functions: {
    invoke: async (name: string, options?: { body?: any }): Promise<any> => {
      try {
        if (name === 'ai-audit') {
          const result = await convex.action(api.ai.growthAudit, { input: options?.body ?? {} })
          const audit = await convex.mutation(api.ai.saveAudit, {
            company_id: options?.body?.company_id ?? undefined,
            lead_id: options?.body?.lead_id ?? undefined,
            audit_type: 'growth',
            result,
            source_data: options?.body ?? {},
          })
          return { data: { ok: true, result, audit_id: audit }, error: null }
        }
        if (name === 'outreach-approve') {`r`n          const result = await convex.mutation(api.outreach.approve, { outreach_event_id: String(options?.body?.outreach_event_id), reason: String(options?.body?.reason ?? 'Approved from ZA Media workspace') })`r`n          return { data: result, error: null }`r`n        }`r`n        if (name === 'outreach-send') {`r`n          const result = await convex.action(api.outreach.send, { outreach_event_id: String(options?.body?.outreach_event_id) })`r`n          return { data: result, error: result?.ok ? null : new Error(result?.reason ?? 'Outreach send blocked') }`r`n        }`r`n        if (name === 'ai-qualify') {
          const result = await convex.action(api.ai.qualifyLead, { lead: options?.body?.lead })
          return { data: { ok: true, result }, error: null }
        }
        return { data: null, error: new Error(`Function ${name} is not configured in the canonical Convex backend`) }
      } catch (error) {
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
      }
    },
  },
  auth: {
    getSession: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
  },
}






