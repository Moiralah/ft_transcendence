import React from 'react';
import Link from 'next/link';
import { Button } from './button';
import { componentTokens } from './colorPalete';

interface NavbarProps {
  brandName?: string;
  ctaText?: string;
  ctaHref?: string;
  themeMode?: 'light';
}

export function Navbar({
  brandName = "My Simple Family Tree",
  ctaText = "Get Started",
  ctaHref ,
  themeMode = 'light',
  } : NavbarProps) {

  const tokens = componentTokens.navbar(themeMode);

  return (
    <header className="fixed top-0 z-40 w-full backdrop-blur-md border-b"
      style= {{
        backgroundColor: tokens.bg,
        borderColor: tokens.border,
      }}
    >
      <nav
        aria-label="Main navigation"
        className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center"
      >
        <Link
          href="/"
          className="rounded-md font-bold text-lg sm:text-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label={`${brandName} Home`}
          style={{
            ['--tw-ring-color' as string]: tokens.focusRing,
            ['--tw-ring-offset-color' as string]: tokens.focusOffset,
          }}
        >
          <span style={{color: tokens.brand1 }}>My Simple</span>
          <span style={{color: tokens.brand2 }}> Family Tree</span>
        </Link>
        <Button href={ctaHref} variant="primary">{ctaText}</Button>
      </nav>
    </header>
  );
}
