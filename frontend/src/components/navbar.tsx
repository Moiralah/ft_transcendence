'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from './button';
import { componentTokens } from './colorPalette';
import { getRole, getSessionId, homeFor } from '@/lib/auth';

interface NavbarProps {
  brandName?: string;
  btnText1?: React.ReactNode;
  btnHref1?: string;
  btnOnClick1?: () => void;
  btnText2?: React.ReactNode;
  btnHref2?: string;
  btnOnClick2?: () => void;
  btnText3?: React.ReactNode;
  btnOnClick3?: () => void;
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
  btnText3,
  btnOnClick3,
  themeMode = 'light',
  } : NavbarProps) {

  const tokens = componentTokens.navbar(themeMode);

  // The logo is "home": the landing page before login, the dashboard after
  // (the admin console for site admins). A guest's only page is its demo
  // tree, so its logo goes to the landing page instead.
  // Read after mount: the session note lives in localStorage, which the server
  // render can't see, so starting at '/' avoids a hydration mismatch.
  const [homeHref, setHomeHref] = useState('/');
  useEffect(() => {
    const role = getRole();
    setHomeHref(getSessionId() && role !== 'GUEST' ? homeFor(role) : '/');
  }, []);

  return (
    <header className="fixed top-0 z-20 w-full backdrop-blur-md border-b"
      style= {{
        backgroundColor: tokens.bg,
        borderColor: tokens.border,
      }}
    >
      <nav
        aria-label="Main navigation"
        className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex justify-between items-center gap-2"
      >
        <Link
          href={homeHref}
          className="min-w-0 grid grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1 leading-tight whitespace-nowrap rounded-md font-bold text-sm min-[360px]:text-base sm:text-xl focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label={`${brandName} Home`}
          style={{
            ['--tw-ring-color' as string]: tokens.focusRing,
            ['--tw-ring-offset-color' as string]: tokens.focusOffset,
          }}
        >
          <span style={{color: tokens.brand1 }}>My Simple</span>
          <span style={{color: tokens.brand2 }}> Family Tree</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 min-[360px]:gap-2 sm:gap-3">
          {btnText1 && (
            <Button
              href={btnHref1}
              onClick={btnOnClick1}
              variant="primary"
              className="max-sm:px-3 max-sm:py-2 max-[359px]:px-2 max-[359px]:text-sm"
            >
              {btnText1}
            </Button>
          )}
          {btnText2 && (
            <Button
              href={btnHref2}
              onClick={btnOnClick2}
              variant="secondary"
              className="max-sm:px-3 max-sm:py-2 max-[359px]:px-2 max-[359px]:text-sm"
            >
              {btnText2}
            </Button>
          )}
          {btnText3 && (
            <Button
              onClick={btnOnClick3}
              variant="ghost"
              className="max-sm:w-auto max-sm:h-auto max-sm:px-2 max-sm:py-2 max-[359px]:text-sm"
            >
              {btnText3}
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
