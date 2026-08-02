import React from 'react';
import Link from 'next/link';

export default function homepage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
      
      {/* NAVIGATION BAR */}
      <header className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="px-6 h-16 flex justify-between items-center font-bold text-sm sm:text-xl">
          
          {/* Logo Home page */}
             <div>
                <span className="text-amber-500">My Simple </span>
                <span>Family Tree</span>
            </div>

          {/* Button navigates to the builder workspace page */}
          <div className="flex items-center">
            <Link href="/signup" className="bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm hover:shadow inline-block">
              Get Started
            </Link>
          </div>
          
        </div>
      </header>

      {/* MAIN CONTENT PLACEHOLDER */}
      <main className="flex flex-col items-center justify-center bg-slate-50">
        
        {/* 1. Welcome / Hero Section */}
        <div className="flex flex-col bg-gray-50 pt-32 pb-20 justify-between items-center text-center px-6 gap-8">
            <h1 className="text-4xl text-bold md:text-6xl font-bold leading-tight text-gray-900">
                My Simple Family Tree Builder
            <br />
            <span className="text-amber-500 text-bold max-w-2xl">Free, Private &amp; No Sign-Up Required.</span></h1>
            <div>
                <span>My Simple Family Tree is 100% free, private, and simple. No sign-up, no membership, and no paywalls. Build your family tree and discover your roots—all in your browser.</span>
            </div>
            <div>
                <Link href="/signup" className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-xl font-semibold transition-all hover:-translate-y-0.5 flex gap-2">
                  <span>Start Building Your Tree &rarr; </span>
                </Link>
            </div>
          </div>

        {/* 2. FEATURES GRID Section */}
        <section className="bg-white border-t border-b border-slate-100 py-20 px-6">
          <div className="px-4">
            
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-slate-900">The Simplest Free Family Tree Builder Online</h2>
              <p className="text-slate-500 text-xl mt-3">We believe genealogy should be accessible to everyone, without barriers or hidden costs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 justify-center mx-auto">
              
              {/* Feature 1: Privacy First */}
              <div className="p-6 rounded-2xl text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">100% Free Forever</h3>
                <p className="text-slate-500 text-lg">
                  No subscriptions, no "premium" features, and no credit card required. Every tool is available to you for free.
                </p>
              </div>

              {/* Feature 2: No Sign-Up */}
              <div className="p-6 rounded-2xl text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold mb-4">
                  ⚡
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No Sign-Up or Membership</h3>
                <p className="text-slate-500 text-lg">
                  Start building immediately. We don't ask for your email or personal details. Your tree is private and stays in your browser.
                </p>
              </div>

              {/* Feature 3: Easy Export */}
              <div className="p-6 rounded-2xl text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold mb-4">
                  💾
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Build Your Tree</h3>
                <p className="text-slate-500 text-lg">
                  Use our GEDCOM import to bring in existing research or start from scratch with My Simple Family Tree.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. COMPATIBILITY LOGOS SECTION */}
        <section className="py-16 bg-gray-50 border-y border-gray-200">
          <div className="mx-auto px-6 text-center">
            <p className="test-xs font-bold mb-10 text-stone-400">
              COMPATIBLE WITH
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-10 mid:gap-x-8 max-w-7xl mx-auto">
              <div className="flex felx-col items-center gap-3 w-28 md:36">
                <div className="h-16 w-16 md:w-24 md:h-24 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center p-3 hover:shadow-md transition-shadow">

                </div>
                <span className="text-xs sm:text-sm font-bold text-gray-500">
                  ANCESTRY
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. FREE GENEALOGY TOOLS SECTION */}
        <section className="bg-white border-t border-b border-slate-100 py-20 px-6">
          <div className="px-6 mx-auto">
            
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-slate-900">Free Genealogy Tools to Find Your Ancestors</h2>
              <p className="text-slate-500 text-xl mt-3">Everything you need to map, analyze, and narrate your family's history.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w mx-auto">

              <div className="p-8 rounded-xl bg-white shadow-sm border border-amber-100 flex flex-col items-center text-center transition-transform hover:translate-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">In-Tree Relationship Estimator</h3>
                <p className="text-gray-600">
                Curious how two people are related? Calculate the exact relationship between any two family members directly within your tree view.
                </p>
              </div>

              <div className="p-8 rounded-xl bg-white shadow-sm border border-amber-100 flex flex-col items-center text-center transition-transform hover:translate-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Add Photos
                </h3>
                <p className="text-gray-600">
                Personalize your family tree by adding photos of your ancestors and relatives directly to their profiles.
                </p>
              </div>

              <div className="p-8 rounded-xl bg-white shadow-sm border border-amber-100 flex flex-col items-center text-center transition-transform hover:translate-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Smart Hints</h3>
                <p className="text-gray-600">
                Stuck? The app analyzes your tree and suggests actionable next steps, like adding missing parents or spouses.
                </p>
              </div>

              <div className="p-8 rounded-xl bg-white shadow-sm border border-amber-100 flex flex-col items-center text-center transition-transform hover:translate-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Birthday Reminders</h3>
                <p className="text-gray-600">
                Never miss a family celebration. See upcoming birthdays for all living relatives in your tree at a glance.
                </p>
              </div>

              <div className="p-8 rounded-xl bg-white shadow-sm border border-amber-100 flex flex-col items-center text-center transition-transform hover:translate-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">AI Biography Generator</h3>
                <p className="text-gray-600">
                Turn your family data into compelling, narrative-style life stories for your ancestors with a single click.
                </p>
              </div>

              <div className="p-8 rounded-xl bg-white shadow-sm border border-amber-100 flex flex-col items-center text-center transition-transform hover:translate-y-1">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  🔒
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Tree Health Check</h3>
                <p className="text-gray-600">
                Automatically scan for common issues like impossible dates or missing information, keeping your data accurate.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* --- 5. PRIVATE & PORTABLE SECTION --- */}
        <section className="bg-gray-50 py-20">
          <div className="mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/2">
                <span className="text-amber-600 font-semibold">
                  PRIVATE & PORTABLE
                </span>
                <h2 className="test-3xl lg:text-4xl font-bold text-gray-900 mt-2">
                  Private & Secure: Your Data, Your Control
                </h2>
                <p className="text-lg text-gray-600 mt-4">
                Your family tree is yours alone. All data is processed in your browser and is never uploaded to a server. Import a standard GEDCOM file to get started, then export your work as a project file, a visual PDF, or a GEDCOM file to share.
                </p>
              </div>
              <div className="md:w-1/2 flex items-center justify-center p-8">
                <div></div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Call to Action banner*/}
        <section className="bg-gray-50 py-20 text-center">
          <div className="mx-auto px-6 flex flex-col items-center gap-10">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
                Start Your Free Family Tree Search Today
              </h2>
              <p className="mt-4 text-lg text-gray-600 max-w-lg mx-auto">
                Start for free. No sign-up required. No membership fees. Your journey into your family's history begins now with our 100% free family tree maker.
              </p>
            </div>
            <div>
              <Link href="/login" className="bg-amber-500 text-white font-bold px-8 py-4 rounded-lg text-lg">
                Create Your Tree Now
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="w-full bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-sm">
        <div className="flex flex-col items-center md:flex-row md:justify-between px-6">
          
          <div className="tracking-wide py-2">
            © 2026 My Simple Family Tree.
          </div>
          
          {/* Internal or External anchor link via Next Link */}
          <div className="flex items-center py-2">
            <Link 
              href="/feedback" 
              className="hover:text-white transition-colors font-medium"
            >
              Give Feedback
            </Link>
          </div>
          
        </div>
      </footer>

    </div>
  );
}