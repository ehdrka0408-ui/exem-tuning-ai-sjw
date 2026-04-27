import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, change, unit }) => {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        {unit && <span className="text-sm text-text-secondary">{unit}</span>}
      </div>
      <p className="mt-1 text-sm text-text-secondary">{label}</p>
      {change !== undefined && (
        <div
          className={`mt-2 flex items-center gap-1 text-sm font-medium ${
            change >= 0 ? 'text-success-dark' : 'text-danger'
          }`}
        >
          {change >= 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span>
            {change >= 0 ? '+' : ''}
            {change}%
          </span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
