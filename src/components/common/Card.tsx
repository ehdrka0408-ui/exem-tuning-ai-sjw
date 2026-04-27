import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
  return (
    <div
      className={`rounded-lg border border-border bg-white p-6 shadow-sm ${className}`}
    >
      {title && (
        <h3 className="mb-4 font-semibold text-text-primary">{title}</h3>
      )}
      {children}
    </div>
  );
};

export default Card;
