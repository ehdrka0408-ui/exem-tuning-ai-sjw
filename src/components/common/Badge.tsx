import React from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success-light text-success-dark',
  danger: 'bg-danger-light text-danger-dark',
  warning: 'bg-warning-light text-warning-dark',
  neutral: 'bg-surface-muted text-text-secondary',
  info: 'bg-info-light text-info-dark',
};

const Badge: React.FC<BadgeProps> = ({ variant, children }) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
};

export default Badge;
