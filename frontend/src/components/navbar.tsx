import React from 'react';
import Link from 'next/link';
import { Button } from './button';
import { componentTokens } from './colorPalette';

interface NavbarProps {
  brandName?: string;
  btnText1?: string;
  btnHref1?: React.ReactNode;
  btnOnClick1?: () => void;
  btnText2?: React.ReactNode;
  btnHref2?: string;
  btnOnClick2?: () => void;
  themeMode?: 'light';
}

export function Navbar({
  brandName = "My Simple Family Tree",
  btnText1 ,
  btnHref1 ,
  btnOnClick1,
  btnText2 ,
  btnHref2 ,  
  btnOnClick2,
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
          className="grid grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1 rounded-md font-bold text-lg sm:text-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label={`${brandName} Home`}
          style={{
            ['--tw-ring-color' as string]: tokens.focusRing,
            ['--tw-ring-offset-color' as string]: tokens.focusOffset,
          }}
        >
          <span style={{color: tokens.brand1 }}>My Simple</span>
          <span style={{color: tokens.brand2 }}> Family Tree</span>
        </Link>
        <div className="flex items-center gap-3">
          {btnText1 && (
            <Button 
              href={btnHref1} 
              onClick={btnOnClick1}
              variant="primary"
            >
              {btnText1}
            </Button>
          )}          
          {btnText2 && (
            <Button 
              href={btnHref2}
              onClick={btnOnClick2}
              variant="primary"
            >
              {btnText2}
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
