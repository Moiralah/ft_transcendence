import React from 'react';
import Link from 'next/link';

export function Footer({ copyrightText = "© 2026 My Simple Family Tree. All rights reserved.", feedbackHref = "/feedback" }) {
  return (
    <footer className="w-full bg-slate-900 text-slate-300 py-8 border-t border-slate-800 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col items-center md:flex-row md:justify-between px-6 gap-4">
        <div>{copyrightText}</div>
        <Link 
          href={feedbackHref} 
          className="hover:text-white transition-colors font-medium rounded focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900 px-1 py-0.5"
        >
          Give Feedback
        </Link>
      </div>
    </footer>
  );
}