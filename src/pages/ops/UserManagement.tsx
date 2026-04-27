import { useState, useMemo } from 'react'
import { Plus, Search, Settings, X, ChevronRight, Trash2 } from 'lucide-react'

type PermKey =
  | 'request'    // 튜닝 요청
  | 'approve'    // 확인 (튜닝완료 → 반영대기 전이)
  | 'apply'      // 운영 반영
  | 'policy'     // 정책 변경
  | 'admin'      // 사용자/그룹 관리

const PERMISSIONS: { key: PermKey; label: string; description: string; risk: 'low' | 'mid' | 'high' }[] = [
  { key: 'request', label: '튜닝 요청',         description: '대상 SQL을 선택해 AI 튜닝 작업을 생성',     risk: 'low'  },
  { key: 'approve', label: '확인',             description: '튜닝완료된 결과를 검토하고 운영 반영 대상으로 확인', risk: 'mid'  },
  { key: 'apply',   label: '운영 반영',         description: '확인된 변경을 운영 DB에 실제 반영 (인덱스 생성 등)', risk: 'high' },
  { key: 'policy',  label: '정책 변경',         description: '자동튜닝 정책·임계값·예외 SQL 관리',       risk: 'mid'  },
  { key: 'admin',   label: '사용자·그룹 관리', description: '계정 생성/수정/삭제, 그룹 및 권한 설정',  risk: 'high' },
]

interface Group {
  name: string
  description: string
  permissions: PermKey[]
  instanceScope: 'all' | string[]   // 'all' = 모든 인스턴스, 또는 인스턴스명 배열
  builtin?: boolean
}

// 인스턴스 목록 (실제로는 InstanceConnections와 공유돼야 하나 PoC라 하드코딩)
const ALL_INSTANCES = ['PROD_1', 'PROD_2', '개발1', '개발2', '스테이징', '운영RAC-1', '운영RAC-2', 'ORA12C', '메인DB', '레플리카']

const initialGroups: Group[] = [
  {
    name: '기본',
    description: '시스템 기본 그룹 — 신규 계정의 기본 소속, 권한 없음',
    permissions: [],
    instanceScope: 'all',
    builtin: true,
  },
  {
    name: 'DBA',
    description: '운영 DBA — 튜닝 요청부터 운영 반영까지 풀 권한',
    permissions: ['request', 'approve', 'apply', 'policy'],
    instanceScope: 'all',
  },
  {
    name: '개발',
    description: '개발자 — 개발/스테이징 인스턴스에서 튜닝 요청만 가능',
    permissions: ['request'],
    instanceScope: ['개발1', '개발2', '스테이징'],
  },
]

interface Account {
  id: string
  accountId: string
  name: string
  phone: string
  email: string
  group: string
  ipRestriction: string | null
  status: 'active' | 'locked'
  lastLogin: string | null
  password?: string
  forcePasswordChange: boolean
  ipRanges: string[]
}

const initialAccounts: Account[] = [
  { id: '1', accountId: 'admin', name: '관리자', phone: '', email: '', group: '기본', ipRestriction: null, status: 'active', lastLogin: '2026-03-26 14:30', forcePasswordChange: false, ipRanges: [] },
  { id: '2', accountId: 'kim.dba', name: '박지은', phone: '010-1234-5678', email: 'kim.dba@example.com', group: 'DBA', ipRestriction: null, status: 'active', lastLogin: '2026-03-22 18:10', forcePasswordChange: false, ipRanges: [] },
  { id: '3', accountId: 'lee.ops', name: '이서연', phone: '010-2345-6789', email: 'lee.ops@example.com', group: 'DBA', ipRestriction: null, status: 'active', lastLogin: '2026-03-22 20:30', forcePasswordChange: false, ipRanges: [] },
  { id: '4', accountId: 'park.dev', name: '박지호', phone: '010-3456-7890', email: 'park.dev@example.com', group: 'DBA', ipRestriction: null, status: 'active', lastLogin: '2026-03-21 23:20', forcePasswordChange: false, ipRanges: [] },
  { id: '5', accountId: 'choi.infra', name: '최수아', phone: '010-4567-8901', email: 'choi.infra@example.com', group: 'DBA', ipRestriction: null, status: 'active', lastLogin: '2026-03-20 17:45', forcePasswordChange: false, ipRanges: [] },
  { id: '6', accountId: 'jung.analyst', name: '정하윤', phone: '010-5678-9012', email: 'jung.analyst@example.com', group: 'DBA', ipRestriction: null, status: 'active', lastLogin: '2026-03-23 01:00', forcePasswordChange: false, ipRanges: [] },
  { id: '7', accountId: 'han.monitor', name: '한도윤', phone: '010-6789-0123', email: 'han.monitor@example.com', group: '개발', ipRestriction: null, status: 'active', lastLogin: '2026-03-21 19:15', forcePasswordChange: false, ipRanges: [] },
  { id: '8', accountId: 'yoon.security', name: '윤시우', phone: '010-7890-1234', email: 'yoon.sec@example.com', group: '개발', ipRestriction: 'Y (1)', status: 'active', lastLogin: '2026-03-20 22:30', forcePasswordChange: false, ipRanges: ['10.10.45.*'] },
  { id: '9', accountId: 'lim.readonly', name: '임서진', phone: '010-8901-2345', email: 'lim.ro@example.com', group: '개발', ipRestriction: null, status: 'locked', lastLogin: null, forcePasswordChange: false, ipRanges: [] },
  { id: '10', accountId: 'oh.manager', name: '오준혁', phone: '010-9012-3456', email: 'oh.manager@example.com', group: '개발', ipRestriction: null, status: 'active', lastLogin: '2026-03-23 17:00', forcePasswordChange: false, ipRanges: [] },
  { id: '11', accountId: 'shin.dba2', name: '신예린', phone: '010-0123-4567', email: 'shin.dba2@example.com', group: '개발', ipRestriction: null, status: 'active', lastLogin: '2026-03-23 02:45', forcePasswordChange: false, ipRanges: [] },
]

const groupColors: Record<string, string> = {
  '기본': 'bg-surface-alt text-text-secondary border-border',
  'DBA': 'bg-code-bg text-code border-code/20',
  '개발': 'bg-success-light text-success-dark border-success/20',
}

const emptyAccount: Omit<Account, 'id'> = {
  accountId: '', name: '', phone: '', email: '', group: '기본',
  ipRestriction: null, status: 'active', lastLogin: null,
  password: '', forcePasswordChange: true, ipRanges: [],
}

const cn = (...xs: (string | false | undefined | null)[]) => xs.filter(Boolean).join(' ')
const inputCls = 'w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action/30'
const selectCls = inputCls

export default function UserManagement() {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [search, setSearch] = useState('')
  const [groupTab, setGroupTab] = useState<'all' | 'group'>('all')
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [isAddMode, setIsAddMode] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [formData, setFormData] = useState<Omit<Account, 'id'>>(emptyAccount)

  const filtered = accounts.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.accountId.toLowerCase().includes(q) || a.name.includes(q) || a.phone.includes(q)
  })

  const groupList = groupTab === 'group' ? [...new Set(filtered.map((a) => a.group))] : []

  const memberCounts = useMemo(() => {
    const m: Record<string, number> = {}
    accounts.forEach((a) => { m[a.group] = (m[a.group] ?? 0) + 1 })
    return m
  }, [accounts])

  const upsertGroup = (orig: string | null, next: Group) => {
    // 이름 중복 검사
    if (groups.some((g) => g.name === next.name && g.name !== orig)) {
      alert('같은 이름의 그룹이 이미 있습니다.')
      return false
    }
    if (!next.name.trim()) { alert('그룹명을 입력하세요.'); return false }

    if (orig === null) {
      setGroups((prev) => [...prev, next])
    } else {
      setGroups((prev) => prev.map((g) => (g.name === orig ? next : g)))
      if (orig !== next.name) {
        setAccounts((prev) => prev.map((a) => (a.group === orig ? { ...a, group: next.name } : a)))
      }
    }
    return true
  }
  const deleteGroup = (name: string) => {
    const target = groups.find((g) => g.name === name)
    if (target?.builtin) { alert('기본 그룹은 삭제할 수 없습니다.'); return }
    const count = memberCounts[name] ?? 0
    const msg = count > 0
      ? `'${name}' 그룹에 ${count}명의 계정이 있습니다.\n해당 계정은 '기본' 그룹으로 이동됩니다. 계속할까요?`
      : `'${name}' 그룹을 삭제할까요?`
    if (!confirm(msg)) return
    setGroups((prev) => prev.filter((g) => g.name !== name))
    setAccounts((prev) => prev.map((a) => (a.group === name ? { ...a, group: '기본' } : a)))
  }

  const openAdd = () => { setIsAddMode(true); setEditingAccount(null); setFormData({ ...emptyAccount }); setDialogOpen(true) }
  const openEdit = (a: Account) => { setIsAddMode(false); setEditingAccount(a); setFormData({ ...a, password: '' }); setDialogOpen(true) }
  const closeDialog = () => { setDialogOpen(false); setEditingAccount(null) }
  const saveAccount = () => {
    if (isAddMode) {
      setAccounts((p) => [...p, { ...formData, id: String(Date.now()) }])
    } else if (editingAccount) {
      setAccounts((p) => p.map((a) => (a.id === editingAccount.id ? { ...formData, id: editingAccount.id } : a)))
    }
    closeDialog()
  }
  const updateForm = (key: keyof Omit<Account, 'id'>, value: string | boolean | string[] | null) => {
    setFormData((p) => ({ ...p, [key]: value }))
  }

  const renderRows = (rows: Account[]) =>
    rows.map((acc) => (
      <tr key={acc.id} className="border-b border-border/60 hover:bg-surface-alt last:border-b-0">
        <td className="px-3 py-2 font-mono text-[12px] text-code font-medium">{acc.accountId}</td>
        <td className="px-3 py-2 text-text-primary">{acc.name || '—'}</td>
        <td className="px-3 py-2 text-text-secondary">{acc.phone || '—'}</td>
        <td className="px-3 py-2 text-text-secondary">{acc.email || '—'}</td>
        <td className="px-3 py-2">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border', groupColors[acc.group] ?? 'bg-surface-alt text-text-secondary border-border')}>
            {acc.group}
          </span>
        </td>
        <td className="px-3 py-2 text-text-muted">
          {acc.ipRestriction ? <span className="text-code font-medium">{acc.ipRestriction}</span> : '—'}
        </td>
        <td className="px-3 py-2">
          {acc.status === 'active' ? (
            <span className="inline-flex items-center gap-1.5 text-text-secondary"><span className="size-1.5 rounded-full bg-success" />활성</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-text-secondary"><span className="size-1.5 rounded-full bg-danger" />잠금</span>
          )}
        </td>
        <td className="px-3 py-2 text-text-muted">{acc.lastLogin ?? '—'}</td>
        <td className="w-12 px-3 py-2 text-center">
          <button className="text-text-muted hover:text-text-primary" onClick={(e) => { e.stopPropagation(); openEdit(acc) }}>
            <Settings className="size-4" />
          </button>
        </td>
      </tr>
    ))

  const Headers = () => (
    <tr className="bg-surface-alt border-b border-border text-left text-text-muted font-medium">
      <th className="px-3 py-2">계정 ID</th>
      <th className="px-3 py-2">이름</th>
      <th className="px-3 py-2">전화번호</th>
      <th className="px-3 py-2">이메일</th>
      <th className="px-3 py-2">그룹</th>
      <th className="px-3 py-2">IP 제한</th>
      <th className="px-3 py-2">상태</th>
      <th className="px-3 py-2">마지막 접속시각</th>
      <th className="w-12 px-3 py-2 text-center">편집</th>
    </tr>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-text-primary">사용자 / 권한</h1>
        <p className="mt-0.5 text-xs text-text-muted">계정 및 접근 권한을 관리합니다.</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">그룹</span>
          <button onClick={() => setGroupTab('all')} className={cn('px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors', groupTab === 'all' ? 'bg-action text-white border-action' : 'bg-white text-text-secondary border-border hover:bg-surface-alt')}>전체</button>
          <button onClick={() => setGroupTab('group')} className={cn('px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors', groupTab === 'group' ? 'bg-action text-white border-action' : 'bg-white text-text-secondary border-border hover:bg-surface-alt')}>소속 그룹</button>

          <div className="relative ml-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색 (계정ID, 이름, 전화번호...)"
              className="pl-8 pr-3 h-8 w-64 text-xs rounded-md border border-border bg-white focus:outline-none focus:ring-1 focus:ring-action/30" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setGroupDialogOpen(true)} className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-white text-text-secondary hover:bg-surface-alt">
            그룹 관리
          </button>
          <button onClick={openAdd} className="h-8 px-3 text-xs font-semibold rounded-md bg-action text-white hover:bg-action-hover flex items-center gap-1">
            <Plus className="size-3.5" /> 계정 생성
          </button>
        </div>
      </div>

      {groupTab === 'all' ? (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><Headers /></thead>
            <tbody>
              {filtered.length > 0 ? renderRows(filtered) : (
                <tr><td colSpan={9} className="text-center py-12 text-sm text-text-muted">검색 결과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {groupList.map((group) => {
            const groupAccounts = filtered.filter((a) => a.group === group)
            return (
              <div key={group}>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{group}</h3>
                <div className="rounded-lg border border-border bg-white overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead><Headers /></thead>
                    <tbody>{renderRows(groupAccounts)}</tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {groupDialogOpen && (
        <GroupManageDialog
          groups={groups}
          memberCounts={memberCounts}
          onClose={() => setGroupDialogOpen(false)}
          onSave={upsertGroup}
          onDelete={deleteGroup}
        />
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[600px] max-h-[calc(90vh/1.1)] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-text-primary">{isAddMode ? '계정 등록' : '계정 편집'}</h2>
              <button onClick={closeDialog} className="text-text-muted hover:text-text-secondary"><X className="size-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="계정 ID *">
                  <input value={formData.accountId} onChange={(e) => updateForm('accountId', e.target.value)} placeholder="예: jsmith" disabled={!isAddMode}
                    className={cn(inputCls, !isAddMode && 'bg-surface-alt text-text-muted')} />
                </Field>
                <Field label="이름"><input value={formData.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="예: 홍길동" className={inputCls} /></Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="전화번호"><input value={formData.phone} onChange={(e) => updateForm('phone', e.target.value)} placeholder="예: 010-1234-5678" className={inputCls} /></Field>
                <Field label="이메일"><input value={formData.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="예: user@example.com" className={inputCls} /></Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label={isAddMode ? '비밀번호 *' : '비밀번호'}>
                  <input type="password" value={formData.password ?? ''} onChange={(e) => updateForm('password', e.target.value)}
                    placeholder={isAddMode ? '비밀번호' : '변경 시에만 입력'} className={inputCls} />
                </Field>
                <Field label="그룹">
                  <div className="flex items-center gap-2">
                    <select value={formData.group} onChange={(e) => updateForm('group', e.target.value)} className={cn(selectCls, 'flex-1')}>
                      {groups.map((g) => (<option key={g.name} value={g.name}>{g.name}</option>))}
                    </select>
                    <button onClick={() => setGroupDialogOpen(true)}
                      className="h-8 px-2 text-xs font-medium rounded-md border border-border bg-white text-text-secondary hover:bg-surface-alt shrink-0">
                      그룹 관리
                    </button>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="상태">
                  <select value={formData.status} onChange={(e) => updateForm('status', e.target.value)} className={selectCls}>
                    <option value="active">활성</option>
                    <option value="locked">잠금</option>
                  </select>
                </Field>
                <Field label="초기 비밀번호 변경 강제">
                  <select value={formData.forcePasswordChange ? 'yes' : 'no'} onChange={(e) => updateForm('forcePasswordChange', e.target.value === 'yes')} className={selectCls}>
                    <option value="yes">예 (첫 로그인 시 변경 요구)</option>
                    <option value="no">아니오</option>
                  </select>
                </Field>
              </div>

              <Field label="IP 접속 제한">
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <span className="text-xs font-medium text-text-secondary">IP 접속 제한</span>
                  <span className="text-xs text-text-muted flex-1">비워두면 전체 허용</span>
                  <ChevronRight className="size-4 text-text-muted" />
                </div>
              </Field>

              <div className="border-t border-border" />

              <button
                className="flex items-center justify-between w-full py-2 text-sm text-text-secondary hover:text-text-primary"
                onClick={() => alert('권한 설정은 준비 중입니다.')}
              >
                <span>권한 설정</span>
                <ChevronRight className="size-4 text-text-muted" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-surface-alt">
              <button onClick={closeDialog} className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-white text-text-secondary hover:bg-surface-alt">
                취소
              </button>
              <button onClick={saveAccount} disabled={!formData.accountId || (isAddMode && !formData.password)}
                className="h-8 px-4 text-xs font-semibold rounded-md bg-action text-white hover:bg-action-hover disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed">
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

const RISK_BADGE: Record<'low' | 'mid' | 'high', string> = {
  low:  'bg-surface-alt text-text-secondary border-border',
  mid:  'bg-warning-light text-warning border-warning/20',
  high: 'bg-danger-light text-danger border-danger/20',
}
const RISK_LABEL: Record<'low' | 'mid' | 'high', string> = { low: '낮음', mid: '주의', high: '위험' }

function GroupManageDialog({
  groups, memberCounts, onClose, onSave, onDelete,
}: {
  groups: Group[]
  memberCounts: Record<string, number>
  onClose: () => void
  onSave: (orig: string | null, next: Group) => boolean
  onDelete: (name: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(groups[0]?.name ?? null)
  const [isNew, setIsNew] = useState(false)
  const [draft, setDraft] = useState<Group | null>(() => groups[0] ? { ...groups[0] } : null)

  const selectGroup = (name: string) => {
    const g = groups.find((x) => x.name === name)
    if (!g) return
    setSelected(name); setIsNew(false); setDraft({ ...g })
  }
  const startNew = () => {
    const blank: Group = { name: '', description: '', permissions: ['request'], instanceScope: 'all' }
    setSelected(null); setIsNew(true); setDraft(blank)
  }

  // 외부에서 그룹 목록이 바뀌면 draft 동기화 (저장 직후 등)
  // selected가 더 이상 없으면 첫 그룹으로 fallback
  if (selected && !groups.some((g) => g.name === selected) && !isNew) {
    const fallback = groups[0]
    if (fallback) { setSelected(fallback.name); setDraft({ ...fallback }) }
  }

  if (!draft) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-lg p-6 text-sm">그룹이 없습니다.</div>
      </div>
    )
  }

  const togglePerm = (key: PermKey) => {
    setDraft((d) => d && ({ ...d, permissions: d.permissions.includes(key) ? d.permissions.filter((k) => k !== key) : [...d.permissions, key] }))
  }
  const setScopeAll = () => setDraft((d) => d && ({ ...d, instanceScope: 'all' }))
  const setScopeSelected = () => setDraft((d) => d && ({ ...d, instanceScope: Array.isArray(d.instanceScope) ? d.instanceScope : [] }))
  const toggleInstance = (name: string) => {
    setDraft((d) => {
      if (!d) return d
      const list = Array.isArray(d.instanceScope) ? d.instanceScope : []
      return { ...d, instanceScope: list.includes(name) ? list.filter((n) => n !== name) : [...list, name] }
    })
  }

  const handleSave = () => {
    if (!draft) return
    const ok = onSave(isNew ? null : selected, draft)
    if (ok) {
      setIsNew(false)
      setSelected(draft.name)
    }
  }

  const isBuiltin = !!draft.builtin
  const memberCount = isNew ? 0 : (memberCounts[draft.name] ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[960px] h-[640px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-primary">그룹 관리</h2>
            <p className="text-xs text-text-muted mt-0.5">그룹 단위로 권한과 인스턴스 접근 범위를 정의합니다. 계정은 한 그룹에 소속됩니다.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary"><X className="size-5" /></button>
        </div>

        {/* Body: master-detail */}
        <div className="flex-1 flex overflow-hidden">
          {/* Master list */}
          <div className="w-[260px] border-r border-border bg-surface-alt/40 flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">그룹 목록</span>
              <button onClick={startNew}
                className="h-6 px-2 text-[11px] font-medium rounded border border-border bg-white text-text-secondary hover:bg-surface-alt flex items-center gap-1">
                <Plus className="size-3" /> 신규
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {groups.map((g) => {
                const active = !isNew && selected === g.name
                return (
                  <button key={g.name} onClick={() => selectGroup(g.name)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b border-border/60 transition-colors',
                      active ? 'bg-white border-l-2 border-l-action' : 'hover:bg-white/60'
                    )}>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-text-primary truncate">{g.name}</span>
                      {g.builtin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-text-muted">기본</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                      <span>계정 {memberCounts[g.name] ?? 0}</span>
                      <span>권한 {g.permissions.length}</span>
                      <span>{g.instanceScope === 'all' ? '인스턴스 전체' : `인스턴스 ${g.instanceScope.length}`}</span>
                    </div>
                  </button>
                )
              })}
              {isNew && (
                <div className="px-3 py-2.5 border-b border-border/60 bg-white border-l-2 border-l-action">
                  <div className="text-[13px] font-medium text-text-primary">{draft.name || '(이름 없음)'}</div>
                  <div className="text-[11px] text-text-muted mt-1">신규 그룹 작성 중</div>
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="그룹명 *">
                <input value={draft.name} disabled={isBuiltin}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="예: DBA1팀"
                  className={cn(inputCls, isBuiltin && 'bg-surface-alt text-text-muted')} />
              </Field>
              <Field label="소속 계정">
                <div className="h-[34px] flex items-center px-3 text-sm text-text-secondary">
                  <span className="font-medium text-text-primary tabular-nums">{memberCount}</span>
                  <span className="ml-1">명</span>
                </div>
              </Field>
            </div>
            <Field label="설명">
              <input value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="이 그룹의 역할/책임" className={inputCls} />
            </Field>

            <div className="border-t border-border" />

            {/* 권한 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold text-text-primary">권한</div>
                  <div className="text-[11px] text-text-muted mt-0.5">이 그룹 소속 계정이 수행할 수 있는 동작</div>
                </div>
                {isBuiltin && (
                  <span className="text-[11px] text-text-muted">기본 그룹은 권한 변경 불가</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map((p) => {
                  const checked = draft.permissions.includes(p.key)
                  return (
                    <label key={p.key}
                      className={cn(
                        'flex items-start gap-2 p-2.5 rounded border cursor-pointer transition-colors',
                        checked ? 'border-action/40 bg-code-bg/40' : 'border-border bg-white hover:bg-surface-alt/40',
                        isBuiltin && 'opacity-60 cursor-not-allowed'
                      )}>
                      <input type="checkbox" className="mt-0.5 rounded" disabled={isBuiltin}
                        checked={checked} onChange={() => togglePerm(p.key)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-text-primary">{p.label}</span>
                          <span className={cn('text-[10px] px-1 py-0.5 rounded border', RISK_BADGE[p.risk])}>{RISK_LABEL[p.risk]}</span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{p.description}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-border" />

            {/* 인스턴스 접근 범위 */}
            <div>
              <div className="text-xs font-semibold text-text-primary mb-1">인스턴스 접근 범위</div>
              <div className="text-[11px] text-text-muted mb-3">이 그룹이 위 권한을 행사할 수 있는 인스턴스를 제한합니다.</div>
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" disabled={isBuiltin}
                    checked={draft.instanceScope === 'all'} onChange={setScopeAll} />
                  <span className="text-[12px] text-text-primary">전체 인스턴스</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" disabled={isBuiltin}
                    checked={draft.instanceScope !== 'all'} onChange={setScopeSelected} />
                  <span className="text-[12px] text-text-primary">선택한 인스턴스만</span>
                </label>
              </div>
              {draft.instanceScope !== 'all' && (
                <div className="grid grid-cols-3 gap-1.5 p-3 rounded border border-border bg-surface-alt/40">
                  {ALL_INSTANCES.map((inst) => {
                    const list = draft.instanceScope as string[]
                    const checked = list.includes(inst)
                    return (
                      <label key={inst} className={cn('flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-[11px]',
                        checked ? 'bg-white' : 'hover:bg-white/60', isBuiltin && 'opacity-60 cursor-not-allowed')}>
                        <input type="checkbox" disabled={isBuiltin} checked={checked} onChange={() => toggleInstance(inst)} />
                        <span className="font-mono text-text-primary">{inst}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-surface-alt shrink-0">
          <div>
            {!isNew && !isBuiltin && (
              <button onClick={() => onDelete(draft.name)}
                className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-white text-danger hover:bg-danger-light flex items-center gap-1">
                <Trash2 className="size-3.5" /> 그룹 삭제
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-white text-text-secondary hover:bg-surface-alt">
              닫기
            </button>
            <button onClick={handleSave} disabled={isBuiltin}
              className="h-8 px-4 text-xs font-semibold rounded-md bg-action text-white hover:bg-action-hover disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed">
              {isNew ? '그룹 생성' : '변경 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
