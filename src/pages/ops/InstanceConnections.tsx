import { useState, useEffect } from 'react'
import { fetchInstances, createInstance, updateInstance, deleteInstance, testInstance, type InstanceMeta } from '../../lib/api'
import { Plus, Search, Settings, Eye, EyeOff, Trash2, RefreshCw, X, Zap } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────
type InstanceType = 'production' | 'staging' | 'development' | ''

interface InstanceRow {
  id: string
  name: string
  alias: string
  ip: string
  port: string
  sid: string
  osType: string
  dbVersion: string
  dbUser: string
  dbPassword: string
  role: string
  instanceType: InstanceType
  status: 'connected' | 'warning' | 'disconnected'
}

const INSTANCE_TYPE_LABEL: Record<InstanceType, string> = {
  production: '운영',
  staging: '검증',
  development: '개발',
  '': '',
}

const INSTANCE_TYPE_STYLE: Record<InstanceType, string> = {
  production: 'bg-danger-bg text-danger-dark',
  staging: 'bg-info-bg text-info-dark',
  development: 'bg-surface-muted text-text-secondary',
  '': '',
}

// [F-3] mock 제거 — backend GET /api/instances 로 채움
const initialInstances: InstanceRow[] = []

// backend → InstanceRow 매핑
function mapBackendInstance(b: InstanceMeta): InstanceRow {
  // backend status (active/inactive) → 화면 status (connected/disconnected)
  const status: InstanceRow['status'] =
    b.status === 'active' ? 'connected' : 'disconnected'
  const itype: InstanceType = (b.instance_type as InstanceType) ?? ''
  return {
    id: b.id,
    name: b.name,
    alias: b.alias ?? '',
    ip: b.host,
    port: String(b.port),
    sid: b.sid,
    osType: '',           // 컬럼 제거 (backend 에 없음, 화면에서도 미사용 권장)
    dbVersion: '',
    dbUser: b.db_user,
    dbPassword: b.db_password,  // GET 시 마스킹("****"), reveal 옵션 필요 시 별도 호출
    role: 'SYSDBA',
    instanceType: itype,
    status,
  }
}

const emptyInstance: Omit<InstanceRow, 'id'> = {
  name: '', alias: '', ip: '', port: '1521', sid: '', osType: 'Linux x86_64',
  dbVersion: '', dbUser: '', dbPassword: '', role: 'SYSDBA', instanceType: '', status: 'disconnected',
}

const statusDot: Record<InstanceRow['status'], string> = {
  connected: 'bg-success',
  warning: 'bg-warning',
  disconnected: 'bg-danger',
}

const cn = (...xs: (string | false | undefined | null)[]) => xs.filter(Boolean).join(' ')

const inputCls = 'w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action/30'
const selectCls = 'w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action/30'

export default function InstanceConnections() {
  const [instances, setInstances] = useState<InstanceRow[]>(initialInstances)
  const [instSearch, setInstSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingInstance, setEditingInstance] = useState<InstanceRow | null>(null)
  const [isAddMode, setIsAddMode] = useState(false)
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState<Omit<InstanceRow, 'id'>>(emptyInstance)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle')

  const filteredInstances = instances.filter((inst) => {
    if (!instSearch) return true
    const q = instSearch.toLowerCase()
    return inst.name.toLowerCase().includes(q) || inst.ip.includes(q) || inst.sid.toLowerCase().includes(q)
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  const openEditDialog = (inst: InstanceRow) => {
    setEditingInstance(inst); setIsAddMode(false); setFormData({ ...inst }); setTestResult('idle')
  }
  const openAddDialog = () => {
    setEditingInstance(null); setIsAddMode(true); setFormData({ ...emptyInstance }); setTestResult('idle')
  }

  // [F-3] backend fetch — 마운트 시 + 외부 변경 후 refresh 가능
  const refreshInstances = async () => {
    try {
      const rows = await fetchInstances()
      setInstances(rows.map(mapBackendInstance))
    } catch (e) { console.error('[fetchInstances failed]', e) }
  }
  useEffect(() => { refreshInstances() }, [])
  const closeDialog = () => { setEditingInstance(null); setIsAddMode(false) }
  const saveInstance = async () => {
    const payload = {
      name: formData.name,
      alias: formData.alias || null,
      host: formData.ip,
      port: parseInt(formData.port, 10) || 1521,
      sid: formData.sid,
      db_user: formData.dbUser,
      db_password: formData.dbPassword,
      db_type: 'Oracle',
      instance_type: (formData.instanceType || null) as 'production' | 'staging' | 'development' | null,
      status: 'active',
    }
    try {
      if (isAddMode) {
        // id 자동 생성 (서버에서 INS-XXX 형식)
        await createInstance({ ...payload, id: `INS-${Date.now().toString(36).toUpperCase()}` })
      } else if (editingInstance) {
        await updateInstance(editingInstance.id, payload)
      }
      await refreshInstances()
      closeDialog()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`저장 실패\n\n${msg}`)
    }
  }
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`선택된 ${selectedIds.size}건을 삭제하시겠습니까?`)) return
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteInstance(id)))
      await refreshInstances()
      setSelectedIds(new Set())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`삭제 실패\n\n${msg}`)
    }
  }

  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const refreshSelected = async () => {
    const ids = new Set(selectedIds)
    setRefreshingIds(ids)
    try {
      // 각 선택된 instance 에 실 연결 테스트
      const results = await Promise.all(
        Array.from(ids).map(id => testInstance(id).then(r => ({ id, ok: r.ok })).catch(() => ({ id, ok: false })))
      )
      setInstances((prev) =>
        prev.map((inst) => {
          const r = results.find(x => x.id === inst.id)
          if (!r) return inst
          return { ...inst, status: r.ok ? 'connected' : 'disconnected' }
        })
      )
    } finally {
      setRefreshingIds(new Set())
      setSelectedIds(new Set())
    }
  }

  const jdbcUrl = `jdbc:oracle:thin:@${formData.ip || '0.0.0.0'}:${formData.port || '1521'}:${formData.sid || 'SID'}`

  const updateForm = (key: keyof Omit<InstanceRow, 'id'>, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-text-primary">인스턴스 / 연결</h1>
        <p className="mt-0.5 text-xs text-text-muted">Oracle DB 인스턴스 연결 정보를 관리합니다.</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
            <input
              value={instSearch}
              onChange={(e) => setInstSearch(e.target.value)}
              placeholder="검색 (이름, IP, SID...)"
              className="pl-8 pr-3 h-8 w-56 text-xs rounded-md border border-border bg-white focus:outline-none focus:ring-1 focus:ring-action/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={deleteSelected}
                className="h-8 px-3 text-xs font-medium rounded-md bg-danger text-white hover:bg-danger-dark flex items-center gap-1"
              >
                <Trash2 className="size-3.5" /> 선택 삭제 ({selectedIds.size})
              </button>
              <button
                onClick={refreshSelected}
                disabled={refreshingIds.size > 0}
                className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-white text-text-secondary hover:bg-surface-alt disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={`size-3.5 ${refreshingIds.size > 0 ? 'animate-spin' : ''}`} /> {refreshingIds.size > 0 ? '갱신 중...' : `선택 갱신 (${selectedIds.size})`}
              </button>
            </>
          )}
          <button
            onClick={openAddDialog}
            className="h-8 px-3 text-xs font-semibold rounded-md bg-action text-white hover:bg-action-hover flex items-center gap-1"
          >
            <Plus className="size-3.5" /> 인스턴스 추가
          </button>
        </div>
      </div>

      {/* Instance table */}
      {filteredInstances.length > 0 ? (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={filteredInstances.length > 0 && filteredInstances.every((i) => selectedIds.has(i.id))}
                    onChange={() => toggleSelectAll(filteredInstances.map((i) => i.id))}
                  />
                </th>
                <th className="w-12 text-left font-medium text-text-muted px-2 py-2">상태</th>
                <th className="text-left font-medium text-text-muted px-3 py-2">인스턴스</th>
                <th className="w-16 text-left font-medium text-text-muted px-3 py-2">특성</th>
                <th className="text-left font-medium text-text-muted px-3 py-2">IP</th>
                <th className="w-16 text-left font-medium text-text-muted px-3 py-2">PORT</th>
                <th className="text-left font-medium text-text-muted px-3 py-2">DB 식별자</th>
                <th className="text-left font-medium text-text-muted px-3 py-2">DB 계정</th>
                <th className="text-left font-medium text-text-muted px-3 py-2">패스워드</th>
                <th className="w-16 text-center font-medium text-text-muted px-3 py-2">편집</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstances.map((inst) => (
                <tr key={inst.id} className="border-b border-border/60 hover:bg-surface-alt last:border-b-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedIds.has(inst.id)}
                      onChange={() => toggleSelect(inst.id)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <span className={cn('inline-block size-2.5 rounded-full', statusDot[inst.status])} />
                  </td>
                  <td className="px-3 py-2 font-medium text-text-primary">{inst.name}</td>
                  <td className="px-3 py-2">
                    {inst.instanceType && (
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', INSTANCE_TYPE_STYLE[inst.instanceType])}>
                        {INSTANCE_TYPE_LABEL[inst.instanceType]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{inst.ip}</td>
                  <td className="px-3 py-2 text-text-secondary">{inst.port}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{inst.sid}</td>

                  <td className="px-3 py-2 text-text-secondary">{inst.dbUser}</td>
                  <td className="px-3 py-2 text-text-muted">
                    <div className="flex items-center gap-1">
                      <span>{showPasswords.has(inst.id) ? inst.dbPassword : '••••••'}</span>
                      <button
                        className="text-text-muted hover:text-text-secondary"
                        onClick={() =>
                          setShowPasswords((prev) => {
                            const next = new Set(prev)
                            if (next.has(inst.id)) next.delete(inst.id); else next.add(inst.id)
                            return next
                          })
                        }
                      >
                        {showPasswords.has(inst.id) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button className="text-text-muted hover:text-text-primary" onClick={() => openEditDialog(inst)}>
                      <Settings className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-text-muted">검색 결과가 없습니다.</div>
      )}

      {/* Dialog */}
      {(editingInstance || isAddMode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[680px] max-h-[calc(90vh/1.1)] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">
                {isAddMode ? '인스턴스 추가' : '인스턴스 편집'}
              </h2>
              <button onClick={closeDialog} className="text-text-muted hover:text-text-secondary">
                <X className="size-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="인스턴스 *"><input value={formData.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="PROD_1" className={inputCls} /></Field>
                  <Field label="별칭"><input value={formData.alias} onChange={(e) => updateForm('alias', e.target.value)} placeholder="운영1" className={inputCls} /></Field>
                  <Field label="특성">
                    <select value={formData.instanceType} onChange={(e) => updateForm('instanceType', e.target.value)} className={selectCls}>
                      <option value="">미지정</option>
                      <option value="production">운영</option>
                      <option value="staging">검증</option>
                      <option value="development">개발</option>
                    </select>
                  </Field>
                  <Field label="IP *"><input value={formData.ip} onChange={(e) => updateForm('ip', e.target.value)} placeholder="10.10.45.101" className={cn(inputCls, 'font-mono')} /></Field>
                  <Field label="PORT *"><input value={formData.port} onChange={(e) => updateForm('port', e.target.value)} placeholder="1521" className={cn(inputCls, 'font-mono')} /></Field>
                  <Field label="DB 식별자 (SID 또는 Service Name) *">
                    <input value={formData.sid} onChange={(e) => updateForm('sid', e.target.value)} placeholder="ORCL 또는 ORCLPDB1.localdomain" className={cn(inputCls, 'font-mono')} />
                  </Field>
                </div>
              </div>

              <div className="border-t border-border" />

              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3">접속 인증</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="DB 계정 *"><input value={formData.dbUser} onChange={(e) => updateForm('dbUser', e.target.value)} placeholder="system" className={inputCls} /></Field>
                  <Field label="패스워드 *"><input type="password" value={formData.dbPassword} onChange={(e) => updateForm('dbPassword', e.target.value)} placeholder="••••••" className={inputCls} /></Field>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={async () => {
                      setTestResult('idle')
                      // 미저장 상태에서는 임시로 신규 등록 후 테스트하기 어려움 — 편집 모드에서만 실 테스트
                      if (!editingInstance) {
                        // 신규 모드: 입력값으로 즉석 테스트 — backend에 임시 등록 없이 검증할 endpoint 없으면 우선 저장 후 테스트 안내
                        setTestResult('idle')
                        alert('신규 인스턴스는 먼저 저장 후, 목록에서 선택 → 새로고침 버튼으로 연결 테스트 가능합니다.')
                        return
                      }
                      try {
                        const r = await testInstance(editingInstance.id)
                        setTestResult(r.ok ? 'success' : 'fail')
                      } catch {
                        setTestResult('fail')
                      }
                    }}
                    className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-white text-text-secondary hover:bg-surface-alt flex items-center gap-1"
                  >
                    <Zap className="size-3.5" /> 연결 테스트
                  </button>
                  {testResult === 'success' && <span className="text-xs text-success-dark font-medium">연결 성공</span>}
                  {testResult === 'fail' && <span className="text-xs text-danger font-medium">연결 실패</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-surface-alt">
              <button onClick={closeDialog} className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-white text-text-secondary hover:bg-surface-alt">
                취소
              </button>
              <button
                onClick={saveInstance}
                disabled={!formData.name || !formData.ip || !formData.port || !formData.sid}
                className="h-8 px-4 text-xs font-semibold rounded-md bg-action text-white hover:bg-action-hover disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  )
}
