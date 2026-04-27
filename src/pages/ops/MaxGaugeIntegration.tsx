import { useState } from 'react'
import { useMaxGaugeStatus, setMaxGaugeConnected } from '../../hooks/useMaxGaugeStatus'

export default function MaxGaugeIntegration() {
  const [mgUrl, setMgUrl] = useState('https://maxgauge.internal:8443')
  const [mgApiKey, setMgApiKey] = useState('mg-api-xxxx-xxxx-xxxx')
  const connected = useMaxGaugeStatus()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-text-primary">MaxGauge 연동</h1>
        <p className="mt-0.5 text-xs text-text-muted">MaxGauge 서버 연결 설정 및 상태를 확인합니다.</p>
      </div>

      <div className="max-w-2xl rounded-lg border border-border bg-white p-5 space-y-5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">MaxGauge 연동</h3>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
              connected ? 'bg-success-light text-success-dark' : 'bg-surface-muted text-text-secondary'
            }`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-text-muted'}`} />
            {connected ? '연결됨' : '미연결'}
          </span>
          {/* 토글 */}
          <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[11px] text-text-muted">연동 사용</span>
            <button
              type="button"
              role="switch"
              aria-checked={connected}
              onClick={() => setMaxGaugeConnected(!connected)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                connected ? 'bg-success' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  connected ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>
        <div className="border-b border-border" />
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mg-url" className="text-xs font-medium text-text-secondary">MaxGauge Server URL</label>
            <input
              id="mg-url"
              value={mgUrl}
              onChange={(e) => setMgUrl(e.target.value)}
              placeholder="https://maxgauge.example.com:8443"
              className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action/30"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mg-key" className="text-xs font-medium text-text-secondary">API Key</label>
            <input
              id="mg-key"
              type="password"
              value={mgApiKey}
              onChange={(e) => setMgApiKey(e.target.value)}
              placeholder="API Key"
              className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action/30"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted">
              마지막 동기화: 2026-03-24 09:00:12
            </div>
            <button className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-alt">
              연결 테스트
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
