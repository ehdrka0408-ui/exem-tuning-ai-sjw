// Alias resolver — scans a SQL's FROM / JOIN / WITH clauses and returns a map
// from lowercased alias → object name.

import { tokenize } from "./sqlHighlight"

const STOP_AFTER_TABLE = new Set([
  "ON", "USING", "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "FETCH",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "CROSS", "FULL", "NATURAL",
  "UNION", "INTERSECT", "EXCEPT", "MINUS", "SELECT", "FROM", "WITH",
  "RETURNING",
])

function isWS(t)    { return t && (t.type === "ws" || t.type === "comment") }
function isIdent(t) { return t && t.type === "ident" }
function upper(t)   { return (t && t.value || "").toUpperCase() }

function skipWs(tokens, i) {
  while (i < tokens.length && isWS(tokens[i])) i++
  return i
}

function skipParenGroup(tokens, i) {
  if (tokens[i]?.type !== "punct" || tokens[i]?.value !== "(") return i
  let depth = 1
  i++
  while (i < tokens.length && depth > 0) {
    if (tokens[i].type === "punct") {
      if (tokens[i].value === "(") depth++
      else if (tokens[i].value === ")") depth--
    }
    i++
  }
  return i
}

export function buildAliasMap(sql) {
  const tokens = tokenize(sql)
  const map = {}

  function register(alias, obj) {
    if (!alias) return
    const key = alias.toLowerCase()
    if (!(key in map)) map[key] = obj
  }

  // WITH ... AS ( ... ) [, cte2 AS ( ... )]
  for (let i = 0; i < tokens.length; i++) {
    if (!isIdent(tokens[i]) || upper(tokens[i]) !== "WITH") continue
    let j = skipWs(tokens, i + 1)
    while (j < tokens.length) {
      if (!isIdent(tokens[j])) break
      const cteName = tokens[j].value
      let k = skipWs(tokens, j + 1)
      if (tokens[k]?.type === "punct" && tokens[k]?.value === "(") {
        k = skipParenGroup(tokens, k)
        k = skipWs(tokens, k)
      }
      if (!isIdent(tokens[k]) || upper(tokens[k]) !== "AS") break
      k = skipWs(tokens, k + 1)
      if (tokens[k]?.type !== "punct" || tokens[k]?.value !== "(") break
      k = skipParenGroup(tokens, k)
      register(cteName, cteName)
      k = skipWs(tokens, k)
      if (tokens[k]?.type === "punct" && tokens[k]?.value === ",") {
        j = skipWs(tokens, k + 1)
        continue
      }
      break
    }
  }

  // FROM / JOIN <table> [AS] <alias>
  for (let i = 0; i < tokens.length; i++) {
    if (!isIdent(tokens[i])) continue
    const kw = upper(tokens[i])
    if (kw !== "FROM" && kw !== "JOIN") continue

    let j = skipWs(tokens, i + 1)
    if (j >= tokens.length) continue

    if (tokens[j].type === "punct" && tokens[j].value === "(") {
      j = skipParenGroup(tokens, j)
      j = skipWs(tokens, j)
      if (isIdent(tokens[j]) && upper(tokens[j]) === "AS") {
        j = skipWs(tokens, j + 1)
      }
      if (isIdent(tokens[j]) && !STOP_AFTER_TABLE.has(upper(tokens[j]))) {
        register(tokens[j].value, "(subquery)")
      }
      continue
    }

    if (!isIdent(tokens[j])) continue
    let objName = tokens[j].value
    if (tokens[j + 1]?.type === "punct" && tokens[j + 1]?.value === "." && isIdent(tokens[j + 2])) {
      objName = tokens[j + 2].value
      j += 2
    }

    register(objName, objName)

    let k = skipWs(tokens, j + 1)
    if (isIdent(tokens[k]) && upper(tokens[k]) === "AS") {
      k = skipWs(tokens, k + 1)
    }
    if (isIdent(tokens[k])) {
      const aliasUp = upper(tokens[k])
      if (!STOP_AFTER_TABLE.has(aliasUp)) {
        register(tokens[k].value, objName)
      }
    }
  }

  return map
}

export function resolveTerm(term, aliasMap) {
  if (!term) return null
  const base = term.split(".")[0].trim().toLowerCase()
  if (!base) return null
  return aliasMap[base] || null
}
