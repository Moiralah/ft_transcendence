// components/system/FeaturesGrid.tsx
import React from 'react';
import { SectionHeader } from './sectionHeader';
import { FeatureCard } from './featureCard';
import { componentTokens } from './colorPalette';

interface featureItem {
    icon: string;
    title: string;
    description: string;
}

interface FeaturesGridProps {
  id: string;
  title?: string;
  subtitle?: string;
  features: featureItem[];
  themeMode?: 'light';
}

export function FeaturesGrid({ id, title, subtitle, features, themeMode}: FeaturesGridProps) {

    const token = componentTokens.featuresGrid(themeMode);

    return (
        <section 
            aria-labelledby={id} 
            className="w-full border-t border-b py-20 px-6"
            style={{
                backgroundColor: token.bg,
                borderColor: token.border,
            }}
        >
            <div className="max-w-7xl mx-auto px-4">
                <SectionHeader id={id} title={title} subtitle={subtitle} />
                {/* Wrapping rows, centred: a last row with fewer cards (e.g. 4 cards, 3
                    across) sits in the middle instead of on the left. Widths match a
                    1 / 2 / 3 column grid with gap-8 (2rem). */}
                <div className="flex flex-wrap justify-center gap-8">
                    {features.map((item, index) => (
                        <div key={index} className="flex w-full md:w-[calc((100%-2rem)/2)] lg:w-[calc((100%-4rem)/3)] [&>*]:w-full">
                            <FeatureCard
                                icon = {item.icon}
                                title = {item.title}
                                description= {item.description} 
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
  );
}