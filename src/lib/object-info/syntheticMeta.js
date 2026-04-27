// 오브젝트 메타가 없을 때 SQL 맥락에서 추출한 컬럼으로 합성.
// v7의 OBJECT_META 포맷과 1:1 호환.

import { tokenize } from './sqlHighlight.js'

function titleCaseToType(col) {
  const u = col.toUpperCase()
  if (u.endsWith('_ID') || u === 'ID') return 'NUMBER(12)'
  if (u.endsWith('_DATE') || u.endsWith('_AT') || u === 'DATE') return 'DATE'
  if (u.endsWith('_AMOUNT') || u.endsWith('_PRICE') || u.endsWith('_TOTAL') || u === 'BALANCE' || u === 'SALARY') return 'NUMBER(14,2)'
  if (u.endsWith('_QTY') || u === 'QUANTITY' || u === 'COUNT') return 'NUMBER(10)'
  if (u.endsWith('_FLAG') || u === 'IS_ACTIVE') return 'CHAR(1)'
  if (u.endsWith('_CODE') || u === 'STATUS' || u === 'TYPE' || u === 'CURRENCY') return 'VARCHAR2(20)'
  if (u.endsWith('_NAME') || u.endsWith('_EMAIL') || u === 'NAME') return 'VARCHAR2(120)'
  return 'VARCHAR2(60)'
}

// 해시 기반 의사-랜덤(같은 이름이면 항상 동일 수치)
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function extractColumnsForObject(sql, objectName, aliasMap) {
  const tokens = tokenize(sql)
  const target = objectName.toLowerCase()
  const aliases = Object.entries(aliasMap)
    .filter(([, v]) => (v || '').toLowerCase() === target)
    .map(([a]) => a.toLowerCase())
  if (aliases.length === 0) aliases.push(target)

  const cols = new Set()

  // alias.COLUMN 패턴
  for (let i = 0; i < tokens.length - 2; i++) {
    const t = tokens[i]
    const dot = tokens[i + 1]
    const col = tokens[i + 2]
    if (!t || !dot || !col) continue
    if (t.type !== 'ident' || dot.type !== 'punct' || dot.value !== '.' || col.type !== 'ident') continue
    if (!aliases.includes((t.value || '').toLowerCase())) continue
    const v = (col.value || '').toUpperCase()
    if (v === '*') continue
    cols.add(v)
  }

  // 단일 테이블 SQL: alias prefix 없이 본문 식별자 전체에서 키워드 제외
  const distinctObjs = new Set(Object.values(aliasMap).map(v => (v || '').toLowerCase()).filter(Boolean))
  if (distinctObjs.size === 1 && distinctObjs.has(target) && cols.size === 0) {
    const SQL_KW = new Set([
      'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','BETWEEN','LIKE','AS','ON','USING',
      'JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','NATURAL','GROUP','BY','ORDER','HAVING',
      'LIMIT','FETCH','OFFSET','UNION','INTERSECT','EXCEPT','MINUS','WITH','DISTINCT','ALL','CASE',
      'WHEN','THEN','ELSE','END','EXISTS','ASC','DESC','COUNT','SUM','AVG','MIN','MAX','TRUNC',
      'SYSDATE','ADD_MONTHS','TO_DATE','ROWNUM','DUAL','MOD','NVL','DECODE','COALESCE',
    ])
    for (const t of tokens) {
      if (t.type !== 'ident') continue
      const u = (t.value || '').toUpperCase()
      if (!u || SQL_KW.has(u) || u === target.toUpperCase()) continue
      if (/^[0-9]/.test(u)) continue
      cols.add(u)
    }
  }

  return Array.from(cols)
}

// WHERE/ON/HAVING 안에서 실제 필터·조인에 쓰인 컬럼만 추려서 인덱스 후보로
function extractPredicateColumns(sql, cols) {
  if (cols.length === 0) return []
  const re = new RegExp(
    '\\b(' + cols.map(c => c.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')).join('|') + ')\\b',
    'gi',
  )
  // WHERE 이후 텍스트만 대충 긁어서 hit 순서 유지
  const m = sql.match(/\b(WHERE|ON|HAVING)\b[\s\S]*$/i)
  if (!m) return cols.slice(0, 3)
  const seen = new Set()
  const out = []
  let x
  while ((x = re.exec(m[0])) !== null) {
    const u = x[1].toUpperCase()
    if (!seen.has(u)) { seen.add(u); out.push(u) }
  }
  return out.length ? out : cols.slice(0, 3)
}

export function buildSyntheticMeta(sql, objectName, aliasMap) {
  const upName = (objectName || 'UNKNOWN').toUpperCase()
  const cols = extractColumnsForObject(sql, objectName, aliasMap)

  // ID 컬럼 자동 추가
  const idCol = `${upName}_ID`
  const allCols = cols.includes(idCol) || cols.includes('ID') ? cols : [idCol, ...cols]

  const h = hash(upName)
  const rows = 1000 + (h % 9900000)
  const avg = 60 + (h % 240)

  const columnsMeta = allCols.map((name) => ({
    name,
    type: titleCaseToType(name),
    nullable: !name.endsWith('_ID') && name !== 'ID' && !name.endsWith('_NAME'),
    distinct: Math.max(1, Math.floor(rows / (1 + ((hash(name) % 500) || 1)))),
    nullCount: name.endsWith('_ID') || name === 'ID' ? 0 : (hash(name) % Math.max(1, Math.floor(rows / 20))),
  }))

  const predCols = extractPredicateColumns(sql, allCols)
  const idxs = []

  // PK
  idxs.push({
    name: `PK_${upName}`,
    type: 'UNIQUE',
    columns: [allCols.includes(idCol) ? idCol : allCols[0]],
  })

  // AS-IS: 첫 predicate 컬럼
  if (predCols.length >= 1) {
    idxs.push({
      name: `IDX_${upName}_${predCols[0]}`,
      type: 'NORMAL',
      columns: [predCols[0]],
      planUsage: 'ASIS',
      rationale: '현재 플랜: 단일 컬럼 필터/조인 키로 사용되는 기존 인덱스',
    })
  }

  // TO-BE: predicate 컬럼들 + 주요 selection 컬럼 커버링
  if (predCols.length >= 1) {
    const tobeCols = predCols.slice(0, 3)
    const covering = allCols.find(c => !tobeCols.includes(c) && (c.endsWith('_NAME') || c.endsWith('_AMOUNT') || c.endsWith('_DATE')))
    if (covering) tobeCols.push(covering)
    idxs.push({
      name: `IDX_${upName}_${tobeCols.slice(0, 2).join('_')}_COV`,
      type: 'NORMAL',
      columns: tobeCols,
      planUsage: 'TOBE',
      isNew: true,
      rationale: '제안 플랜: 필터·조인 키 + 선택 컬럼 커버링으로 IO 감소',
    })
  }

  return {
    name: upName,
    type: 'TABLE',
    schema: 'AUTO',
    totalRows: rows,
    avgRowBytes: avg,
    lastAnalyzed: null,
    note: '⚠️ 카탈로그 미등록 — SQL 본문에서 자동 합성된 메타정보입니다.',
    columns: columnsMeta,
    indexes: idxs,
  }
}
