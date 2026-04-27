import { Fragment, useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react'

/* ─── Types ─── */
export interface ColumnDef<T> {
  key: string
  header: ReactNode
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, rowIndex: number) => ReactNode
  resizable?: boolean
  draggable?: boolean
  sortable?: boolean
  /** 2-level header: 동일 group 값을 가진 연속 컬럼은 상단 group 헤더로 묶임. 미설정이면 단일 헤더. */
  group?: string
}

export type SortDirection = 'asc' | 'desc' | null
export interface SortState { key: string; direction: SortDirection }

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  rowKey: keyof T | ((row: T) => string)
  onRowClick?: (row: T, rowIndex: number, event: React.MouseEvent) => void
  onRowHover?: (row: T | null) => void
  onColumnsChange?: (columns: ColumnDef<T>[]) => void
  renderExpandedRow?: (row: T, rowIndex: number) => ReactNode | null
  rowClassName?: (row: T, rowIndex: number) => string
  rowDraggable?: (row: T, rowIndex: number) => boolean
  onRowDragReorder?: (fromKey: string, toKey: string) => void
  className?: string
  borderless?: boolean
  hideHeader?: boolean
  /** Fit columns to container width (no horizontal scroll). Uses tableLayout: auto. */
  fluid?: boolean
  /** Enable virtual scrolling for large datasets */
  virtualScroll?: boolean
  /** Row height in px for virtual scroll calculation (default: 33) */
  rowHeight?: number
  /** Controlled sort state */
  sort?: SortState
  /** Called when user clicks a sortable column header */
  onSortChange?: (sort: SortState) => void
}

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' }
const DEFAULT_ROW_HEIGHT = 33
const OVERSCAN = 10

/* ─── Component ─── */
export default function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  onRowHover,
  onColumnsChange,
  renderExpandedRow,
  rowClassName,
  rowDraggable,
  onRowDragReorder,
  className = '',
  borderless = false,
  fluid = false,
  hideHeader = false,
  virtualScroll = false,
  rowHeight = DEFAULT_ROW_HEIGHT,
  sort,
  onSortChange,
}: DataTableProps<T>) {
  /* ── Column Widths ── */
  const [colWidths, setColWidths] = useState<number[]>(() =>
    columns.map(c => c.width ?? 150),
  )

  useEffect(() => {
    setColWidths(prev => columns.map((c, i) => prev[i] ?? c.width ?? 150))
  }, [columns.length])

  const resizeRef = useRef<{ colIndex: number; startX: number; startW: number } | null>(null)

  const onResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { colIndex, startX: e.clientX, startW: colWidths[colIndex] }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const { colIndex: ci, startX, startW } = resizeRef.current
      const min = columns[ci].minWidth ?? 50
      const newW = Math.max(min, startW + (ev.clientX - startX))
      setColWidths(prev => {
        const next = [...prev]
        next[ci] = newW
        return next
      })
    }

    const onUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [colWidths, columns])

  /* ── Column Drag Reorder ── */
  const [dragCol, setDragCol] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const handleDragStart = useCallback((ci: number, e: React.DragEvent) => {
    setDragCol(ci)
    e.dataTransfer.effectAllowed = 'move'
    // Transparent drag image
    const el = document.createElement('div')
    el.style.opacity = '0'
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 0, 0)
    setTimeout(() => document.body.removeChild(el), 0)
  }, [])

  const handleDragOver = useCallback((ci: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(ci)
  }, [])

  const handleDrop = useCallback((ci: number, e: React.DragEvent) => {
    e.preventDefault()
    if (dragCol !== null && dragCol !== ci && onColumnsChange) {
      const newCols = [...columns]
      const newWidths = [...colWidths]
      const [movedCol] = newCols.splice(dragCol, 1)
      const [movedWidth] = newWidths.splice(dragCol, 1)
      newCols.splice(ci, 0, movedCol)
      newWidths.splice(ci, 0, movedWidth)
      onColumnsChange(newCols)
      setColWidths(newWidths)
    }
    setDragCol(null)
    setDropTarget(null)
  }, [dragCol, columns, colWidths, onColumnsChange])

  const handleDragEnd = useCallback(() => {
    setDragCol(null)
    setDropTarget(null)
  }, [])

  /* ── Row Drag Reorder ── */
  const [dragRowKey, setDragRowKey] = useState<string | null>(null)
  const [dropRowKey, setDropRowKey] = useState<string | null>(null)

  const handleRowDragStart = useCallback((key: string, e: React.DragEvent) => {
    setDragRowKey(key)
    e.dataTransfer.effectAllowed = 'move'
    const el = document.createElement('div')
    el.style.opacity = '0'
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 0, 0)
    setTimeout(() => document.body.removeChild(el), 0)
  }, [])

  const handleRowDragOver = useCallback((key: string, e: React.DragEvent) => {
    if (!dragRowKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropRowKey(key)
  }, [dragRowKey])

  const handleRowDrop = useCallback((key: string, e: React.DragEvent) => {
    e.preventDefault()
    if (dragRowKey && dragRowKey !== key && onRowDragReorder) {
      onRowDragReorder(dragRowKey, key)
    }
    setDragRowKey(null)
    setDropRowKey(null)
  }, [dragRowKey, onRowDragReorder])

  const handleRowDragEnd = useCallback(() => {
    setDragRowKey(null)
    setDropRowKey(null)
  }, [])

  /* ── Row Key ── */
  const getRowKey = useCallback(
    (row: T): string => {
      if (typeof rowKey === 'function') return rowKey(row)
      return String(row[rowKey])
    },
    [rowKey],
  )

  /* ── Virtual Scroll ── */
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(0)

  useEffect(() => {
    if (!virtualScroll || !scrollRef.current) return
    const el = scrollRef.current
    setViewHeight(el.clientHeight)
    const observer = new ResizeObserver(entries => {
      setViewHeight(entries[0].contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [virtualScroll])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!virtualScroll) return
    setScrollTop(e.currentTarget.scrollTop)
  }, [virtualScroll])

  const { visibleData, startIdx, topPad, bottomPad, totalCount } = useMemo(() => {
    if (!virtualScroll) return { visibleData: data, startIdx: 0, topPad: 0, bottomPad: 0, totalCount: data.length }
    const total = data.length
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN)
    const end = Math.min(total, Math.ceil((scrollTop + viewHeight) / rowHeight) + OVERSCAN)
    return {
      visibleData: data.slice(start, end),
      startIdx: start,
      topPad: start * rowHeight,
      bottomPad: Math.max(0, (total - end) * rowHeight),
      totalCount: total,
    }
  }, [virtualScroll, data, scrollTop, viewHeight, rowHeight])

  /* ── Render ── */
  return (
    <div className={`flex-1 min-h-0 overflow-auto flex flex-col ${borderless ? '' : 'rounded-lg border border-border bg-white shadow-sm'} ${className}`}>
      <div
        ref={scrollRef}
        className={virtualScroll ? 'overflow-auto flex-1 min-h-0' : (fluid ? 'overflow-hidden' : '')}
        onScroll={virtualScroll ? handleScroll : undefined}
      >
        <table className="w-full text-[13px]" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            {(() => {
              const total = colWidths.reduce((a, b) => a + b, 0) || 1
              return columns.map((col, i) => (
                <col key={col.key} style={fluid ? { width: `${(colWidths[i] / total) * 100}%` } : { width: colWidths[i] }} />
              ))
            })()}
          </colgroup>

          {!hideHeader && (() => {
            // 2중 헤더: 연속 동일 group 값을 묶어 상단 행 생성
            const hasGroup = columns.some(c => !!c.group)
            const groupSpans: { label: string; span: number; key: string }[] = []
            if (hasGroup) {
              let i = 0
              while (i < columns.length) {
                const g = columns[i].group
                if (g) {
                  let j = i + 1
                  while (j < columns.length && columns[j].group === g) j++
                  groupSpans.push({ label: g, span: j - i, key: `g-${g}-${i}` })
                  i = j
                } else {
                  groupSpans.push({ label: '', span: 1, key: `ng-${columns[i].key}` })
                  i++
                }
              }
            }
            return (
            <thead className="sticky top-0 z-[2] bg-white">
              {hasGroup && (
                <tr className="border-b border-surface-muted text-center text-[10px] font-medium text-text-muted uppercase tracking-wide">
                  {groupSpans.map(gs => (
                    <th
                      key={gs.key}
                      colSpan={gs.span}
                      className={`px-3 py-1 ${gs.label ? 'border-l border-r border-surface-muted bg-surface-alt/40' : ''}`}
                    >
                      {gs.label}
                    </th>
                  ))}
                </tr>
              )}
              <tr className="border-b border-surface-muted text-left text-[11px] font-normal text-text-muted">
                {columns.map((col, ci) => (
                  <th
                    key={col.key}
                    draggable={col.draggable !== false && !!onColumnsChange}
                    onDragStart={e => handleDragStart(ci, e)}
                    onDragOver={e => handleDragOver(ci, e)}
                    onDrop={e => handleDrop(ci, e)}
                    onDragEnd={handleDragEnd}
                    className={`group/th relative select-none px-3 py-1 ${ALIGN_CLASS[col.align ?? 'left']} ${
                      col.draggable !== false && onColumnsChange ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${dragCol === ci ? 'opacity-40' : ''} ${
                      dropTarget === ci && dragCol !== ci ? 'border-l-2 border-action' : ''
                    } ${col.sortable !== false && onSortChange ? 'cursor-pointer hover:text-text-secondary' : ''}`}
                    onClick={col.sortable !== false && onSortChange ? () => {
                      if (!sort || sort.key !== col.key) {
                        onSortChange({ key: col.key, direction: 'asc' })
                      } else if (sort.direction === 'asc') {
                        onSortChange({ key: col.key, direction: 'desc' })
                      } else {
                        onSortChange({ key: '', direction: null })
                      }
                    } : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sort && sort.key === col.key && sort.direction && (
                        <span className="text-action text-[9px]">{sort.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                    {(col.resizable !== false) && (
                      <div
                        className="absolute -right-px top-0 z-10 flex h-full w-[7px] cursor-col-resize items-center justify-center"
                        onMouseDown={e => onResizeStart(ci, e)}
                        draggable={false}
                      >
                        <div className="h-4 w-px bg-border group-hover/th:bg-action" />
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            )
          })()}

          <tbody className="divide-y divide-slate-100">
            {virtualScroll && topPad > 0 && (
              <tr style={{ height: topPad }}><td colSpan={columns.length} /></tr>
            )}
            {visibleData.map((row, i) => {
              const ri = virtualScroll ? startIdx + i : i
              const expandedContent = renderExpandedRow?.(row, ri)
              return (
                <Fragment key={getRowKey(row)}>
                  <tr
                    className={`group transition-colors duration-100 ${onRowClick ? 'cursor-pointer' : ''} hover:bg-slate-50 hover:shadow-[inset_3px_0_0_0_var(--color-border)] ${rowClassName?.(row, ri) ?? ''} ${dragRowKey === getRowKey(row) ? 'opacity-40' : ''} ${dropRowKey === getRowKey(row) && dragRowKey !== getRowKey(row) ? 'border-t-2 border-action' : ''} ${rowDraggable?.(row, ri) ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    draggable={rowDraggable?.(row, ri) ?? false}
                    onDragStart={rowDraggable?.(row, ri) ? (e) => handleRowDragStart(getRowKey(row), e) : undefined}
                    onDragOver={rowDraggable?.(row, ri) ? (e) => handleRowDragOver(getRowKey(row), e) : undefined}
                    onDrop={rowDraggable?.(row, ri) ? (e) => handleRowDrop(getRowKey(row), e) : undefined}
                    onDragEnd={rowDraggable?.(row, ri) ? handleRowDragEnd : undefined}
                    onClick={(e) => {
                      const sel = window.getSelection()?.toString()
                      if (sel && sel.length > 0) return
                      onRowClick?.(row, ri, e)
                    }}
                    onMouseEnter={() => onRowHover?.(row)}
                    onMouseLeave={() => onRowHover?.(null)}
                  >
                    {columns.map((col) => {
                      const raw = (row as Record<string, unknown>)[col.key]
                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-1 overflow-hidden ${ALIGN_CLASS[col.align ?? 'left']} ${
                            dropTarget === columns.indexOf(col) && dragCol !== null && dragCol !== columns.indexOf(col) ? 'border-l-2 border-action' : ''
                          }`}
                        >
                          <div className="truncate">
                            {col.render ? col.render(raw, row, ri) : (raw == null ? '' : String(raw))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                  {expandedContent && (
                    <tr>
                      <td colSpan={columns.length} className="p-0">
                        <div style={fluid ? undefined : { width: colWidths.reduce((a, b) => a + b, 0) }}>
                          {expandedContent}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {virtualScroll && bottomPad > 0 && (
              <tr style={{ height: bottomPad }}><td colSpan={columns.length} /></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Virtual scroll footer — row count */}
      {virtualScroll && (
        <div className="flex-shrink-0 border-t border-surface-muted px-3 py-1.5 text-[11px] text-text-muted bg-white">
          총 {totalCount.toLocaleString()}건
        </div>
      )}
    </div>
  )
}
