// components/system/Navbar.tsx
import React from 'react';
import Link from 'next/link';
import { Button } from './button';

export function Navbar({ brandName = "My Simple Family Tree", ctaText = "Get Started", ctaHref = "/builder" }) {
  return (
    <header className="fixed top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200">
      <nav aria-label="Main navigation" className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
        <Link 
          href="/" 
          className="rounded-md font-bold text-lg sm:text-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          aria-label={`${brandName} Home`}
        >
          <span className="text-amber-700">My Simple </span>
          <span className="text-slate-900">Family Tree</span>
        </Link>
        <Button href={ctaHref} variant="primary">{ctaText}</Button>
      </nav>
    </header>
  );
}