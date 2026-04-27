import type { AliasMap } from './index'
export function buildAliasMap(sql: string): AliasMap
export function resolveTerm(term: string, aliasMap: AliasMap): string | null
