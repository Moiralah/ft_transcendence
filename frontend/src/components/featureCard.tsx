// components/system/FeatureCard.tsx
import React, { ReactNode } from 'react';
import { Icon } from './icon';
import { Typography } from './typograph';
import { componentTokens } from './colorPalete';

interface FeatureCardProps {
    icon: string;
    title: string;
    description: string;
    themeMode?: 'light';
}

export function FeatureCard({ 
    icon, 
    title, 
    description, 
    themeMode = 'light' 
}: FeatureCardProps) 
{ 
    const token = componentTokens.featuresGrid(themeMode);

    return (
    <div className="p-6 rounded-2xl text-center border flex flex-col items-center"
        style={{
            backgroundColor: token.bgCard,
            borderColor: token.borderCard,
        }}
    >
        <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold mb-4"
            style={{
                backgroundColor: token.bgCard2,
                color: token.text, 
            }}
        >
            <Icon symbol={icon} />
        </div>
        <Typography as="h3" variant="h3" className="mb-2">{title}</Typography>
        <Typography as="p" variant="body" className="text-base">{description}</Typography>
    </div>
  );
}