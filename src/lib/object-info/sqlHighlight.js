// SQL highlight utilities (v6 = v5 + findMatchesMulti / highlightSqlMulti).

const CLAUSE_START = new Set(["WHERE", "ON", "HAVING"])
const CONTINUATION = new Set(["AND", "OR"])
const CLAUSE_END = new Set([
  "GROUP", "ORDER", "LIMIT", "FETCH", "OFFSET",
  "UNION", "INTERSECT", "EXCEPT", "MINUS",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "NATURAL",
  "FROM", "WHERE", "HAVING", "SELECT", "WITH", "RETURNING",
])

export function tokenize(sql) {
  const tokens = []
  const n = sql.length
  let i = 0
  while (i < n) {
    const c = sql[i]
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      let j = i + 1
      while (j < n && /\s/.test(sql[j])) j++
      tokens.push({ type: "ws", start: i, end: j })
      i = j; continue
    }
    if (c === "-" && sql[i + 1] === "-") {
      let j = i + 2
      while (j < n && sql[j] !== "\n") j++
      tokens.push({ type: "comment", start: i, end: j })
      i = j; continue
    }
    if (c === "/" && sql[i + 1] === "*") {
      let j = i + 2
      while (j < n - 1 && !(sql[j] === "*" && sql[j + 1] === "/")) j++
      j = Math.min(n, j + 2)
      tokens.push({ type: "comment", start: i, end: j })
      i = j; continue
    }
    if (c === "'") {
      let j = i + 1
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue }
          j++; break
        }
        j++
      }
      tokens.push({ type: "string", start: i, end: j })
      i = j; continue
    }
    if (c === '"') {
      let j = i + 1
      while (j < n && sql[j] !== '"') j++
      j = Math.min(n, j + 1)
      tokens.push({ type: "ident", start: i, end: j, value: sql.slice(i, j) })
      i = j; continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_$#]/.test(sql[j])) j++
      tokens.push({ type: "ident", start: i, end: j, value: sql.slice(i, j) })
      i = j; continue
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1
      while (j < n && /[0-9.]/.test(sql[j])) j++
      tokens.push({ type: "number", start: i, end: j })
      i = j; continue
    }
    tokens.push({ type: "punct", start: i, end: i + 1, value: c })
    i++
  }
  return tokens
}

export function findPredicateUnits(tokens) {
  const units = []
  const stack = []
  let depth = 0
  const topScope = () => stack[stack.length - 1]
  const inScopeNow = () => stack.length > 0 && depth === topScope().scopeDepth
  function closeUnit(endPos) {
    const top = topScope()
    if (!top) return
    if (top.unitStart != null && endPos > top.unitStart) {
      units.push({ start: top.unitStart, end: endPos, clause: top.clause })
    }
    top.unitStart = null
  }
  function firstSigFrom(i) {
    let j = i
    while (j < tokens.length && (tokens[j].type === "ws" || tokens[j].type === "comment")) j++
    return j
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === "ws" || t.type === "comment") continue
    if (t.type === "punct") {
      if (t.value === "(") { depth++ }
      else if (t.value === ")") {
        depth--
        while (stack.length > 0 && topScope().scopeDepth > depth) {
          closeUnit(t.start); stack.pop()
        }
      } else if (t.value === ";") {
        while (stack.length > 0) { closeUnit(t.start); stack.pop() }
      } else if (t.value === "," && inScopeNow()) {
        closeUnit(t.start); stack.pop()
      }
      continue
    }
    if (t.type !== "ident") continue
    const up = (t.value || "").toUpperCase()
    if (up === "BETWEEN" && inScopeNow()) {
      topScope().betweenPending = true
      continue
    }
    if (CLAUSE_START.has(up)) {
      if (inScopeNow()) closeUnit(t.start)
      const nextSig = firstSigFrom(i + 1)
      stack.push({
        scopeDepth: depth,
        unitStart: nextSig < tokens.length ? tokens[nextSig].start : t.end,
        betweenPending: false,
        clause: up,
      })
      continue
    }
    if (CONTINUATION.has(up) && inScopeNow()) {
      if (up === "AND" && topScope().betweenPending) {
        topScope().betweenPending = false
        continue
      }
      closeUnit(t.start)
      const nextSig = firstSigFrom(i + 1)
      topScope().unitStart = nextSig < tokens.length ? tokens[nextSig].start : t.end
      continue
    }
    if (CLAUSE_END.has(up) && inScopeNow()) {
      closeUnit(t.start); stack.pop()
      i--
      continue
    }
  }
  const eof = tokens.length > 0 ? tokens[tokens.length - 1].end : 0
  while (stack.length > 0) { closeUnit(eof); stack.pop() }
  return units
}

export function findMatches(text, term, { caseInsensitive = true } = {}) {
  if (!term) return []
  const body = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const flags = caseInsensitive ? "gi" : "g"
  const re = new RegExp(`(?:^|[^A-Za-z0-9_])(${body})(?=$|[^A-Za-z0-9_])`, flags)
  const out = []
  let m
  while ((m = re.exec(text)) !== null) {
    const hit = m[1]
    const hitStart = m.index + (m[0].length - hit.length)
    out.push({ start: hitStart, end: hitStart + hit.length })
    if (re.lastIndex === m.index) re.lastIndex++
  }
  return out
}

export function findMatchesMulti(text, terms, opts = {}) {
  const all = []
  for (const t of (terms || [])) {
    if (!t) continue
    for (const m of findMatches(text, t, opts)) all.push(m)
  }
  all.sort((a, b) => (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)))
  const merged = []
  let lastEnd = -1
  for (const m of all) {
    if (m.start >= lastEnd) {
      merged.push(m)
      lastEnd = m.end
    }
  }
  return merged
}

function escChar(c) {
  if (c === "&") return "&amp;"
  if (c === "<") return "&lt;"
  if (c === ">") return "&gt;"
  return c
}

export function buildHighlightedHtml(text, areas, matches) {
  const opens  = new Map()
  const closes = new Map()
  function addOpen(pos, tag)  { if (!opens.has(pos))  opens.set(pos, []);  opens.get(pos).push(tag) }
  function addClose(pos, tag) { if (!closes.has(pos)) closes.set(pos, []); closes.get(pos).push(tag) }
  for (const a of areas)   { addOpen(a.start, '<span class="hl-area">'); addClose(a.end, "</span>") }
  for (const m of matches) { addOpen(m.start, "<mark>"); addClose(m.end, "</mark>") }
  let out = ""
  for (let i = 0; i <= text.length; i++) {
    if (closes.has(i)) {
      const list = closes.get(i)
      for (let k = list.length - 1; k >= 0; k--) out += list[k]
    }
    if (opens.has(i)) for (const tag of opens.get(i)) out += tag
    if (i < text.length) out += escChar(text[i])
  }
  return out
}

function areasFromMatches(text, matches, showAreas) {
  if (!showAreas || matches.length === 0) return []
  const tokens = tokenize(text)
  const allUnits = findPredicateUnits(tokens)
  return allUnits.filter(u =>
    matches.some(m => m.start >= u.start && m.end <= u.end)
  )
}

export function highlightSql(text, term, { caseInsensitive = true, showAreas = true } = {}) {
  if (!term) {
    return { html: escapeAll(text), areaCount: 0, matchCount: 0 }
  }
  const matches = findMatches(text, term, { caseInsensitive })
  const areas = areasFromMatches(text, matches, showAreas)
  const html = buildHighlightedHtml(text, areas, matches)
  return { html, areaCount: areas.length, matchCount: matches.length }
}

export function highlightSqlMulti(text, terms, { caseInsensitive = true, showAreas = true } = {}) {
  const valid = (terms || []).filter(Boolean)
  if (valid.length === 0) {
    return { html: escapeAll(text), areaCount: 0, matchCount: 0 }
  }
  const matches = findMatchesMulti(text, valid, { caseInsensitive })
  const areas = areasFromMatches(text, matches, showAreas)
  const html = buildHighlightedHtml(text, areas, matches)
  return { html, areaCount: areas.length, matchCount: matches.length }
}

function escapeAll(text) {
  let out = ""
  for (const c of text) out += escChar(c)
  return out
}

export function findPredicatesForObject(sql, objectName, aliasMap, objectColumns) {
  if (!objectName) return []
  const target = objectName.toLowerCase()
  const aliases = Object.entries(aliasMap)
    .filter(([, v]) => (v || "").toLowerCase() === target)
    .map(([a]) => a)

  const units = findPredicateUnits(tokenize(sql))
  if (units.length === 0) return []

  // 대상 오브젝트의 alias 집합 + 다른 오브젝트의 alias 집합
  const myAliases = new Set(aliases.map(a => a.toLowerCase()))
  const otherAliases = new Set(
    Object.entries(aliasMap)
      .filter(([, v]) => (v || "").toLowerCase() !== target)
      .map(([a]) => a.toLowerCase())
  )

  // 결과 누적
  const pickedKeys = new Set()
  const picked = []
  function add(u) {
    const key = u.start + ":" + u.end
    if (pickedKeys.has(key)) return
    pickedKeys.add(key)
    picked.push(u)
  }

  // ─── 1) 각 predicate 를 순회하며 3가지 근거 중 하나라도 만족하면 귀속 ───
  const colList = Array.isArray(objectColumns) ? objectColumns.filter(Boolean) : []
  const colRe = colList.length
    ? new RegExp(
        "(?:^|[^A-Za-z0-9_\\.])(" +
        colList.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
        ")(?=$|[^A-Za-z0-9_])",
        "gi",
      )
    : null

  for (const u of units) {
    const text = sql.slice(u.start, u.end)
    let matched = false

    // (a) 내 alias 가 prefix 로 등장 (`o.order_date`, `c.customer_id` 등)
    for (const a of myAliases) {
      const re = new RegExp(
        "(?:^|[^A-Za-z0-9_])(" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?=\\s*\\.)",
        "i",
      )
      if (re.test(text)) { matched = true; break }
      // alias 가 테이블 이름 자체일 수도 있음
      const re2 = new RegExp(
        "(?:^|[^A-Za-z0-9_])(" + a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?=$|[^A-Za-z0-9_])",
        "i",
      )
      if (re2.test(text)) { matched = true; break }
    }

    // (b) alias prefix 가 전혀 없는 predicate 이고, 내 컬럼명이 포함됨
    //     → 단일 테이블 맥락의 bare column 매칭
    if (!matched && colRe) {
      // 이 predicate 안에서 참조된 alias prefix 들을 수집
      const prefRe = /\b([A-Za-z_]\w*)\s*\./g
      let mm
      const refs = []
      while ((mm = prefRe.exec(text)) !== null) refs.push(mm[1].toLowerCase())
      const hasMyPref = refs.some(r => myAliases.has(r))
      const hasOnlyOtherPrefs = refs.length > 0 && refs.every(r => otherAliases.has(r))
      // 이미 prefix 가 있으면 (a) 에서 잡혔을 것. 여기선 "prefix 없음" 인 경우만 column 매치 시도
      if (!hasOnlyOtherPrefs) {
        colRe.lastIndex = 0
        if (colRe.test(text)) {
          if (refs.length === 0 || hasMyPref) matched = true
        }
      }
    }

    if (matched) add(u)
  }

  // ─── 2) 그래도 하나도 없으면: 단일 테이블 SQL 전체 귀속 ───
  if (picked.length === 0) {
    const distinctObjects = new Set(
      Object.values(aliasMap).map(v => (v || "").toLowerCase()).filter(Boolean)
    )
    if (distinctObjects.size === 1 && distinctObjects.has(target)) {
      for (const u of units) add(u)
    }
  }

  picked.sort((a, b) => a.start - b.start)
  return picked.map(u => ({
    clause: u.clause || "?",
    text: sql.slice(u.start, u.end).trim(),
    start: u.start,
    end: u.end,
  }))
}
