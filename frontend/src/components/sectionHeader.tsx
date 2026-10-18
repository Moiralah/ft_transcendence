import React from 'react';
import { Typography } from './typograph';
import { componentTokens } from './colorPalette';

interface SectionHeaderProps {
  id: string;
  title?: string;
  subtitle?: string;
}

export function SectionHeader({ id, title, subtitle }: SectionHeaderProps) {
  return (
    <div className="text-center mb-16">
        <Typography 
            as="h2" 
            variant="h2" 
            id={id}
        >
        {title}
        </Typography>
        
        {subtitle && (
            <Typography 
                as="p" 
                variant="body" 
                className="mt-3 text-xl"
            >
                {subtitle}
            </Typography>
            )}
    </div>
  );
}