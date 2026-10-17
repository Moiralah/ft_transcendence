import React from 'react';

import { SkipLink } from '../components/SkipLink';
import { Navbar } from '../components/navbar';
import { Footer } from '../components/footer';
import { Banner } from '../components/banner';
import { componentTokens } from '@/components/colorPalette';

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
                <Banner
                    id="hero-heading"
                    headingLevel="h1"
                    emphasis="high"
                    title="My Simple Family Tree Builder"
                    highlightText="Free & Private"
                    description="My Simple Family Tree is 100% free, private, and simple. Build your tree directly in your browser."
                    actions={[
                        { label: 'Start Building Your Tree', href: '/signup', variant: 'primary', showArrow: true },
                        { label: 'Try as Guest', href: '/guest', variant: 'secondary' },
                    ]}
                />

                <Banner
                    id="cta-heading"
                    headingLevel="h2"
                    emphasis="medium"
                    title="Start Your Free Family Tree Search Today"
                    description="Start for free. No sign-up required. Your journey into your family's history begins now."
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
