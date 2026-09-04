'use client'

import React from 'react';
import Link from 'next/link';
import { componentTokens } from './colorPalette';

interface FooterProps {
  copyrightText?: string;
  feedbackHref?: string;
  themeMode?:'light';
}

export function Footer({ 
  copyrightText = "© 2026 My Simple Family Tree. All rights reserved.", 
  feedbackHref = "/feedback",
  themeMode = 'light'
  } : FooterProps) {

  const tokens = componentTokens.footer(themeMode);

  return (
    <footer 
      aria-label="Site Footer"
      className="w-full py-8 border-t text-sm"
        style={{
        backgroundColor: tokens.bg,
        borderColor: tokens.border,
        color: tokens.text,
      }}>
      <div className="max-w-7xl mx-auto flex flex-col items-center md:flex-row md:justify-between px-6 gap-4">
        <div>{copyrightText}</div>
        <Link 
          href={feedbackHref} 
          className="transition-colors font-medium rounded px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            color: tokens.text,
            ['--tw-ring-color' as string]: tokens.focusRing,
            ['--tw-ring-offset-color' as string]: tokens.focusOffset,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = tokens.linkHover)}
          onMouseLeave={(e) => (e.currentTarget.style.color = tokens.text)}
        >
          Give Feedback
        </Link>
      </div>
    </footer>
  ); 
}