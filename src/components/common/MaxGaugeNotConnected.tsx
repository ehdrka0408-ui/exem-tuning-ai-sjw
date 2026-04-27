import { Link } from 'react-router-dom'
import { PlugZap, ArrowRight } from 'lucide-react'

export default function MaxGaugeNotConnected({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white py-16 px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
        <PlugZap className="h-6 w-6 text-text-muted" />
      </div>
      <p className="text-sm font-semibold text-text-primary">MaxGauge 연동이 필요합니다</p>
      <p className="mt-1.5 max-w-sm text-xs text-text-muted leading-relaxed">
        {feature}은(는) MaxGauge에서 수집한 데이터를 기반으로 동작합니다.
        연동 설정을 완료한 뒤 다시 접속해 주세요.
      </p>
      <Link
        to="/ops/integration/maxgauge"
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-action-hover transition-colors"
      >
        연동 설정으로 이동
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
