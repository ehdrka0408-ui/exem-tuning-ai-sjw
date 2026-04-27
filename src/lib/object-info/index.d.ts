export interface TokenMatch { start: number; end: number }
export interface PredicateRef { clause: string; text: string; start: number; end: number }
export interface HighlightResult { html: string; areaCount: number; matchCount: number }
export interface AliasMap { [alias: string]: string }

export interface ColumnMeta {
  name: string
  type: string
  nullable: boolean
  distinct: number | null
  nullCount: number | null
}
export interface IndexMeta {
  name: string
  type: string
  columns: string[]
  planUsage?: 'ASIS' | 'TOBE' | 'BOTH'
  isNew?: boolean
  rationale?: string
}
export interface ObjectMeta {
  name: string
  type: string
  schema: string
  totalRows: number | null
  avgRowBytes: number | null
  lastAnalyzed: string | null
  note?: string
  columns: ColumnMeta[]
  indexes: IndexMeta[]
}

declare module './sqlHighlight' {
  export function tokenize(sql: string): any[]
  export function findMatches(text: string, term: string, opts?: { caseInsensitive?: boolean }): TokenMatch[]
  export function findPredicatesForObject(sql: string, objectName: string, aliasMap: AliasMap, objectColumns?: string[]): PredicateRef[]
  export function highlightSqlMulti(text: string, terms: string[], opts?: { caseInsensitive?: boolean; showAreas?: boolean }): HighlightResult
}
declare module './aliasResolver' {
  export function buildAliasMap(sql: string): AliasMap
  export function resolveTerm(term: string, aliasMap: AliasMap): string | null
}
declare module './objectMeta' {
  export function getObjectMeta(name: string): ObjectMeta | null
  export const OBJECT_META: Record<string, ObjectMeta>
}
