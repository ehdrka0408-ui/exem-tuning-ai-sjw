import React from 'react';

type SourceType = 'maxgauge' | 'awr' | 'v$sql';

interface SourceBadgeProps {
  source: SourceType;
}

const sourceConfig: Record<SourceType, { label: string; className: string }> = {
  maxgauge: {
    label: 'MaxGauge',
    className: 'bg-maxgauge-bg text-maxgauge-text',
  },
  awr: {
    label: 'AWR',
    className: 'bg-awr-bg text-awr-text',
  },
  'v$sql': {
    label: 'V$SQL',
    className: 'bg-vsql-bg text-vsql-text',
  },
};

const SourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  const config = sourceConfig[source];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
};

export default SourceBadge;
