import type { TokenMatch, PredicateRef, HighlightResult, AliasMap } from './index'
export function tokenize(sql: string): Array<{ type: string; start: number; end: number; value?: string }>
export function findMatches(text: string, term: string, opts?: { caseInsensitive?: boolean }): TokenMatch[]
export function findPredicatesForObject(sql: string, objectName: string, aliasMap: AliasMap, objectColumns?: string[]): PredicateRef[]
export function highlightSqlMulti(text: string, terms: string[], opts?: { caseInsensitive?: boolean; showAreas?: boolean }): HighlightResult
