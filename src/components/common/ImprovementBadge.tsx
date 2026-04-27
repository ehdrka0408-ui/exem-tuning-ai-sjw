import React from 'react';

interface ImprovementBadgeProps {
  rate: number | null | undefined;
}

const ImprovementBadge: React.FC<ImprovementBadgeProps> = ({ rate }) => {
  if (rate == null || rate === 0) {
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-text-muted/40">—</span>;
  }
  const improved = rate > 0;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${improved ? 'text-success-dark' : 'text-danger-dark'}`}>
      {improved ? '↓' : '↑'}{Math.abs(rate)}%
    </span>
  );
};

export default ImprovementBadge;
