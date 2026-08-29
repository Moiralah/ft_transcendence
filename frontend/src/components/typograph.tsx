import React from 'react';

interface TextProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
  className?: string;
  id?: string;
}

export function Typography({ children, as = 'p', variant = 'body', className = '', id }: TextProps) {
  const Component = as;

  const styles = {
    h1: 'text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight',
    h2: 'text-3xl md:text-4xl font-bold text-slate-900 tracking-tight',
    h3: 'text-xl font-bold text-slate-900',
    body: 'text-slate-600 text-base md:text-lg leading-relaxed',
    caption: 'text-xs font-bold text-slate-600 tracking-wider uppercase',
  };

  return (
    <Component id={id} className={`${styles[variant]} ${className}`}>
      {children}
    </Component>
  );
}