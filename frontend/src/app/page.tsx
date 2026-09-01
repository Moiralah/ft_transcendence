import React from 'react';

import { SkipLink } from '../components/SkipLink';
import { Navbar } from '../components/navbar';
import { Footer } from '../components/footer';
import { Banner } from '../components/banner';
import { FeaturesGrid } from '../components/featureGrid';

import { featureItems } from '../data/featureItem';
import { toolItems } from '../data/toolItem';

export default function main() {
    return (
        <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
            <SkipLink />
            <header id="navbar" tabIndex={-1} className="focus:outline-none">
                <Navbar ctaHref = "/signup"/>
            </header>
            <main id="main-content" tabIndex={-1} className="focus:outline-none">
                <Banner
                    id="hero-heading"
                    headingLevel="h1"
                    emphasis="high"
                    title="My Simple Family Tree Builder"
                    highlightText="Free, Private & No Sign-Up Required."
                    description="My Simple Family Tree is 100% free, private, and simple. Build your tree directly in your browser."
                    actions={[
                        { label: 'Start Building Your Tree', href: '/signup', variant: 'primary', showArrow: true },
                    ]}
                />

                <FeaturesGrid
                    id="features-heading"
                    title="The Simplest Free Family Tree Builder Online"
                    subtitle="We believe genealogy should be accessible to everyone."
                    features={featureItems}
                />

                <FeaturesGrid
                    id="tool-heading"
                    title="Free Genealogy Tools to Find Your Ancestors"
                    subtitle="Everything you need to map, analyze, and narrate your family's history."
                    features={toolItems}
                />

                <Banner
                    id="cta-heading"
                    headingLevel="h2"
                    emphasis="medium"
                    title="Start Your Free Family Tree Search Today"
                    description="Start for free. No sign-up required. Your journey into your family's history begins now."
                    actions={[
                        { label: 'Create Your Tree Now', href: '/builder', variant: 'primary' },
                    ]}
                />
            </main>
            <footer id="footer" tabIndex={-1} className="focus:outline-none">
                <Footer/>
            </footer>
        </div>

    );
}
