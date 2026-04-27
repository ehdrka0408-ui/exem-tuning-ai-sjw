import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, RotateCcw } from 'lucide-react'
import Button from '../common/Button'
import DiffViewer from './DiffViewer'

type Phase = 'input' | 'waiting' | 'result'

export interface DirectInputResult {
  id: string
  sqlBefore: string
  sqlAfter: string
  planBefore: string
  planAfter: string
  improvement: number
  rationale: string[]
  types: ('index' | 'hint' | 'rewrite')[]
}

interface Props {
  onResult: (result: DirectInputResult) => void
}

const TYPE_LABELS: Record<string, string> = {
  index: '인덱스', hint: '힌트', rewrite: '리라이트',
}

/* Mock: 직접 입력 SQL에 대한 AI 튜닝 결과 생성 */
function mockTuningResult(sql: string): DirectInputResult {
  const id = `DI-${Date.now().toString(36)}`
  return {
    id,
    sqlBefore: sql,
    sqlAfter: `SELECT /*+ INDEX(o IX_ORDERS_DATE) USE_NL(c) */\n       o.order_id,\n       o.order_date,\n       c.customer_name,\n       SUM(oi.quantity * oi.unit_price) AS total\n  FROM ORDERS o\n  JOIN CUSTOMERS c ON o.customer_id = c.id\n  JOIN ORDER_ITEMS oi ON o.order_id = oi.order_id\n WHERE o.created_at > SYSDATE - 30\n GROUP BY o.order_id, o.order_date, c.customer_name\n ORDER BY total DESC`,
    planBefore: `SQL_ID  demo_before, child number 0
Plan hash value: 1234567890

------------------------------------------------------------------
| Id  | Operation              | Name         | Rows  | Buffers |
------------------------------------------------------------------
|   0 | SELECT STATEMENT       |              |       |   45000 |
|   1 |  SORT ORDER BY         |              | 28000 |   45000 |
|   2 |   HASH GROUP BY        |              | 28000 |   44000 |
|*  3 |    HASH JOIN           |              |280000 |   42000 |
|*  4 |     HASH JOIN          |              | 28000 |   15000 |
|*  5 |      TABLE ACCESS FULL | ORDERS       | 28000 |   12000 |
|   6 |      TABLE ACCESS FULL | CUSTOMERS    |  5000 |    3000 |
|   7 |     TABLE ACCESS FULL  | ORDER_ITEMS  |280000 |   27000 |
------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   3 - access("O"."ORDER_ID"="OI"."ORDER_ID")
   4 - access("O"."CUSTOMER_ID"="C"."ID")
   5 - filter("O"."CREATED_AT">SYSDATE@!-30)`,
    planAfter: `SQL_ID  demo_after, child number 0
Plan hash value: 9876543210

------------------------------------------------------------------------
| Id  | Operation                       | Name            | Rows  | Buffers |
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                |                 |       |    5200 |
|   1 |  SORT ORDER BY                  |                 |  2800 |    5200 |
|   2 |   HASH GROUP BY                 |                 |  2800 |    5000 |
|   3 |    NESTED LOOPS                 |                 | 28000 |    4800 |
|   4 |     NESTED LOOPS                |                 | 28000 |    3200 |
|*  5 |      TABLE ACCESS BY INDEX ROWID| ORDERS          |  2800 |    1200 |
|*  6 |       INDEX RANGE SCAN          | IX_ORDERS_DATE  |  2800 |     450 |
|*  7 |      TABLE ACCESS BY INDEX ROWID| CUSTOMERS       |     1 |    2000 |
|*  8 |       INDEX UNIQUE SCAN         | PK_CUSTOMERS    |     1 |    1000 |
|*  9 |     TABLE ACCESS BY INDEX ROWID | ORDER_ITEMS     |    10 |    1600 |
|* 10 |      INDEX RANGE SCAN           | IX_OI_ORDER     |    10 |     800 |
------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   5 - filter("O"."CREATED_AT">SYSDATE@!-30)
   6 - access("O"."CREATED_AT">SYSDATE@!-30)
   7 - filter(NULL IS NOT NULL)
   8 - access("O"."CUSTOMER_ID"="C"."ID")
   9 - filter(NULL IS NOT NULL)
  10 - access("O"."ORDER_ID"="OI"."ORDER_ID")`,
    improvement: -88,
    rationale: [
      'ORDERS 테이블 FULL SCAN → IX_ORDERS_DATE 인덱스 활용으로 대상 행 28,000건에서 2,800건으로 축소',
      'HASH JOIN → NESTED LOOPS 전환: 인덱스 기반 접근으로 조인 비용 대폭 감소',
      'Buffer Gets 45,000 → 5,200 (88% 감소): 전체 I/O 부하 크게 개선',
    ],
    types: ['hint', 'index'],
  }
}

export default function DirectCanvas({ onResult }: Props) {
  const [phase, setPhase] = useState<Phase>('input')
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<DirectInputResult | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    if (!sql.trim()) return
    setPhase('waiting')
    setTimeout(() => {
      const r = mockTuningResult(sql)
      setResult(r)
      setPhase('result')
    }, 2500 + Math.random() * 1500)
  }, [sql])

  // Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && phase === 'input' && sql.trim()) {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, sql, handleSubmit])

  const handleReset = () => {
    setPhase('input')
    setSql('')
    setResult(null)
  }

  const handleSaveToWorkbench = () => {
    if (result) onResult(result)
  }

  /* ── Waiting ── */
  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <div className="relative w-20 h-14 flex flex-col items-center justify-center gap-[5px]">
          <div className="cost-bar-1 h-[5px] bg-code/50 rounded-full" />
          <div className="cost-bar-2 h-[5px] bg-code/35 rounded-full" />
          <div className="cost-bar-3 h-[5px] bg-code/20 rounded-full" />
          <div className="cost-sweep-line absolute left-1/2 -translate-x-1/2 w-[70%] h-px" />
        </div>
        <div className="text-center">
          <div className="text-[13px] text-text-primary font-medium">AI가 SQL을 분석하고 있습니다</div>
          <div className="text-[12px] text-text-muted mt-1">실행 계획 수집 → 비용 분석 → 개선안 생성</div>
        </div>
      </div>
    )
  }

  /* ── Result ── */
  if (phase === 'result' && result) {
    return (
      <div className="flex flex-col h-full">
        {/* Result header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-code bg-code-bg">
              <Sparkles size={11} /> 사용자 SQL입력 결과
            </span>
            <span className={`text-[16px] font-bold tabular-nums ${result.improvement < 0 ? 'text-success' : 'text-danger'}`}>
              {result.improvement}%
            </span>
            <div className="flex gap-1">
              {result.types.map(t => (
                <span key={t} className="px-1.5 py-0.5 text-[11px] bg-code-bg text-code rounded font-medium">
                  {TYPE_LABELS[t] || t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-text-secondary border border-border rounded-lg hover:bg-surface-alt transition-colors"
            >
              <RotateCcw size={13} /> 새 입력
            </button>
            <button
              onClick={handleSaveToWorkbench}
              className="flex items-center gap-1 px-4 py-1.5 text-[13px] font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors"
            >
              작업 등록
            </button>
          </div>
        </div>

        {/* AI rationale bar */}
        <div className="px-4 py-2 border-b border-border bg-code-bg/30 shrink-0">
          <div className="text-[11px] text-text-secondary leading-relaxed">
            {result.rationale[0]}
            {result.rationale.length > 1 && (
              <span className="text-text-muted ml-1">외 {result.rationale.length - 1}건</span>
            )}
          </div>
        </div>

        {/* DiffViewer */}
        <div className="flex-1 min-h-0">
          <DiffViewer
            sqlBefore={result.sqlBefore}
            sqlAfter={result.sqlAfter}
            planBefore={result.planBefore}
            planAfter={result.planAfter}
            viewMode="sql+plan"
          />
        </div>
      </div>
    )
  }

  /* ── Input ── */
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-[720px] px-8">
        <div className="mb-8 text-center">
          <h2 className="text-[20px] font-semibold text-text-primary leading-tight">사용자 SQL입력</h2>
          <p className="text-[13px] text-text-muted mt-2 leading-relaxed">
            튜닝할 SQL을 입력하세요. AI가 실행계획을 분석하고 최적화 방안을 제안합니다.
          </p>
        </div>

        <div className="relative group">
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            placeholder={`SELECT o.order_id, o.order_date,\n       c.customer_name,\n       SUM(oi.quantity * oi.unit_price) total\n  FROM orders o\n  JOIN customers c ON o.customer_id = c.id\n  JOIN order_items oi ON o.order_id = oi.order_id\n WHERE o.created_at > SYSDATE - 30\n ORDER BY total DESC`}
            className="w-full h-56 p-5 font-mono text-[13px] leading-[1.6] bg-surface-alt/70 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-code/25 focus:border-code/40 placeholder:text-text-muted/40 transition-all"
            spellCheck={false}
            autoFocus
          />
          {sql.length > 0 && (
            <div className="absolute bottom-3 right-3 text-[10px] text-text-muted tabular-nums">
              {sql.split('\n').length}행 · {sql.length}자
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-[11px] text-text-muted">
            <kbd className="px-1 py-0.5 bg-surface-alt border border-border rounded text-[10px]">Ctrl</kbd>
            <span className="mx-0.5">+</span>
            <kbd className="px-1 py-0.5 bg-surface-alt border border-border rounded text-[10px]">Enter</kbd>
            <span className="ml-1">실행</span>
          </div>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!sql.trim()}
            className="flex items-center gap-2 px-5"
          >
            <Sparkles size={14} />
            AI 튜닝 요청
          </Button>
        </div>
      </div>
    </div>
  )
}
