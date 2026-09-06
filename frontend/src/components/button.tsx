// components/system/Button.tsx
import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children?: React.ReactNode;
  href?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  onClick?: () => void;
}

export function Button({ children, href, variant = 'primary', className = '', onClick }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2 whitespace-nowrap";
  const variants = {
    primary: "bg-amber-700 hover:bg-amber-800 text-white px-6 py-3 shadow-md hover:-translate-y-0.5",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-800 px-5 py-2.5 border border-slate-200",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-700 px-4 py-2",
  };

  const combinedClasses = `${baseStyles} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={combinedClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={combinedClasses}>
      {children}
    </button>
  );
}