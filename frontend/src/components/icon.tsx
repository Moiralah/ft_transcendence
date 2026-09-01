import React from 'react';

export interface IconProps {
  symbol: string;
  label?: string;
  className?: string;
}

export function Icon({ symbol, label, className = '' }: IconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      aria-hidden={!label}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {symbol}
    </span>
  );
}