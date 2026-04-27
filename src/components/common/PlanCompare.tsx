import React from 'react';

interface PlanCompareProps {
  original: string;
  tuned: string;
}

const highlightLine = (line: string): string => {
  if (line.includes('TABLE ACCESS FULL')) {
    return 'bg-red-50 text-red-600';
  }
  if (line.includes('INDEX FULL SCAN')) {
    return 'bg-amber-50 text-amber-600';
  }
  return '';
};

const PlanColumn: React.FC<{ label: string; plan: string }> = ({ label, plan }) => {
  const lines = plan.split('\n');

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-2 text-sm font-semibold text-slate-700">{label}</div>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50">
        <pre className="p-3 font-mono text-xs leading-relaxed">
          {lines.map((line, i) => {
            const highlight = highlightLine(line);
            return (
              <div key={i} className={highlight ? `${highlight} px-1 -mx-1` : ''}>
                {line}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

const PlanCompare: React.FC<PlanCompareProps> = ({ original, tuned }) => {
  return (
    <div className="flex gap-4">
      <PlanColumn label="AS-IS" plan={original} />
      <PlanColumn label="TO-BE" plan={tuned} />
    </div>
  );
};

export default PlanCompare;
