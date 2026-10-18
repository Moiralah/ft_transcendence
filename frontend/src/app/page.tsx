import React from 'react';

import { SkipLink } from '../components/SkipLink';
import { Navbar } from '../components/navbar';
import { Footer } from '../components/footer';
import { Banner } from '../components/banner';
import { FeaturesGrid } from '@/components/featureGrid';
import { toolItems } from '@/data/toolItem';
import { featureItems } from '@/data/featureItem';
import { howItWorks } from '@/data/featureItem';
import { faqs } from '@/data/featureItem';
import { componentTokens } from '@/components/colorPalette';
import { GuestEndedNotice } from '@/components/guestEndedNotice';

export default function main() {

    const token = componentTokens;
    return (
        <div
            className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans"
        >
            <SkipLink />
            <header id="navbar" tabIndex={-1} className="focus:outline-none">
                <Navbar
                    btnText1="Get Started"
                    btnHref1 = "/signup"
                    btnText2 = "Login"
                    btnHref2 = "/login"
                />
            </header>
            {/* flex-1 keeps the footer at the bottom when the page is shorter than the
                window (e.g. zoomed out); the last section grows so it stays white. */}
            <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col [&>section:last-child]:flex-1 focus:outline-none">
                <GuestEndedNotice />
                <Banner
                    id="hero-heading"
                    headingLevel="h1"
                    emphasis="high"
                    title="My Simple Family Tree Builder"
                    highlightText="Free & Private"
                    description="My Simple Family Tree is 100% free, private, and simple. Build your family tree. Collaborative workspace to create your family tree with your family"
                    actions={[
                        { label: 'Start Building Your Tree', href: '/signup', variant: 'primary', showArrow: true },
                        { label: 'Try as Guest', href: '/guest', variant: 'secondary' },
                    ]}
                />


        {/* Features */}
        <FeaturesGrid
          id="features-heading"
          title="The simplest free family tree builder online"
          subtitle="Genealogy should be accessible to everyone — not locked behind a paywall."
          features={featureItems}
        />

        {/* How it works */}
        <section
          aria-labelledby="how-heading"
          className="w-full bg-slate-50 py-20 px-6"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2
                id="how-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight"
              >
                How it works
              </h2>
              <p className="mt-3 text-lg md:text-xl text-slate-600">
                A tree in three simple steps.
              </p>
            </div>

            <ol className="grid md:grid-cols-3 gap-6">
              {howItWorks.map((step, i) => (
                <li
                  key={step.title}
                  className="bg-white p-6 rounded-2xl border border-slate-200"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-bold"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Free tools */}
        <FeaturesGrid
          id="tools-heading"
          title="Free genealogy tools to find your ancestors"
          subtitle="Everything you need to map, analyze, and narrate your family's history."
          features={toolItems}
        />

        {/* FAQ */}
        <section
          aria-labelledby="faq-heading"
          className="w-full bg-white py-20 px-6"
        >
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2
                id="faq-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight"
              >
                Frequently asked questions
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                Everything you might be wondering before you start.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl border border-slate-200 bg-slate-50 open:bg-white open:shadow-sm transition-colors"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 text-left font-semibold text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600 [&::-webkit-details-marker]:hidden">
                    <span>{faq.q}</span>
                    <span
                      aria-hidden="true"
                      className="text-2xl leading-none text-slate-400 group-open:rotate-45 transition-transform"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-slate-600 [overflow-wrap:anywhere]">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

                <Banner
                    id="cta-heading"
                    headingLevel="h2"
                    emphasis="medium"
                    title="Start Your Free Family Tree Search Today"
                    description="Start for free. Sign-up to keep building. Your journey into your family's history begins now."
                    actions={[
                        { label: 'Create Your Tree Now', href: '/signup', variant: 'primary' },
                    ]}
                />
            </main>
            <footer id="footer" tabIndex={-1} className="focus:outline-none">
                <Footer/>
            </footer>
        </div>

    );
}
