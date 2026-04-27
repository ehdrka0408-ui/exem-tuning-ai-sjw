import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SqlTextBlockProps {
  sql: string;
  maxLines?: number;
}

const SqlTextBlock: React.FC<SqlTextBlockProps> = ({ sql, maxLines = 3 }) => {
  const [expanded, setExpanded] = useState(false);
  const lines = sql.split('\n');
  const needsTruncation = lines.length > maxLines;

  const displayText = expanded
    ? sql
    : lines.slice(0, maxLines).join('\n') + (needsTruncation ? '\n...' : '');

  return (
    <div className="rounded-md border border-border bg-surface-alt">
      <pre
        className="overflow-x-auto p-3 font-mono text-sm text-text-primary"
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {displayText}
      </pre>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 border-t border-border py-1.5 text-xs text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Expand
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default SqlTextBlock;
