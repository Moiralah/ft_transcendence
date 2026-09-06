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
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center">
                    {features.map((item, index) => (
                        <div key={index}>
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