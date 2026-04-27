// DBMS_XPLAN.DISPLAY_CURSOR ALLSTATS LAST 포맷 실행계획 렌더러
// 포팅 from oracle-tuning-console
export function PlanText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <pre className={className}>
      {lines.map((line, i) => (
        <PlanLine key={i} line={line} />
      ))}
    </pre>
  );
}

function PlanLine({ line }: { line: string }) {
  if (/^\s+\d+\s*-\s*(access|filter)\(/.test(line)) {
    const match = line.match(/^(\s+\d+\s*-\s*)(access|filter)(\(.*)$/);
    if (match) {
      const isAccess = match[2] === 'access';
      return (
        <div className="leading-[18px]">
          <span className="text-[#999]">{match[1]}</span>
          <span className={isAccess ? 'text-[#2563eb] font-medium' : 'text-[#0891b2] font-medium'}>
            {match[2]}
          </span>
          <span className="text-[#666]">{match[3]}</span>
        </div>
      );
    }
  }

  if (/^\|?\s*\*?\s*\d+\s*\|/.test(line) || /^\|\s+\d+\s+\|/.test(line)) {
    return <PlanTableRow line={line} />;
  }

  if (/^(SQL_ID|Plan hash value|Predicate Information|Note)/.test(line)) {
    return <div className="leading-[18px] text-[#888] font-medium">{line}</div>;
  }

  if (/^-{10,}/.test(line)) {
    return <div className="leading-[18px] text-[#ddd]">{line}</div>;
  }

  return <div className="leading-[18px]">{line}</div>;
}

function PlanTableRow({ line }: { line: string }) {
  const highlights: { pattern: string; bg: string; text: string }[] = [
    { pattern: 'TABLE ACCESS FULL', bg: 'bg-[#fee2e2]', text: 'text-[#c00] font-semibold' },
    { pattern: 'INDEX FULL SCAN', bg: 'bg-[#fff7e0]', text: 'text-[#d97706] font-semibold' },
  ];

  for (const h of highlights) {
    if (line.includes(h.pattern)) {
      const idx = line.indexOf(h.pattern);
      return (
        <div className="leading-[18px]">
          {line.slice(0, idx)}
          <span className={`${h.bg} ${h.text}`}>{h.pattern}</span>
          {line.slice(idx + h.pattern.length)}
        </div>
      );
    }
  }

  return <div className="leading-[18px]">{line}</div>;
}
