import React from 'react';
import { Typography } from './typograph';
import { Button } from './button';

interface BannerAction {
    label: string;
    href: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    showArrow?: boolean;
}

interface BannerProps {
    id: string;
    title: string;
    highlightText?: string;
    description: string;
    actions: BannerAction[];
    badge?: string,
    emphasis?: 'low' | 'medium' | 'high';
    headingLevel? : 'h1' | 'h2' | 'h3';
}

export function Banner ({
    id,
    title,
    highlightText,
    description,
    actions,
    badge,
    emphasis = 'medium',
    headingLevel = 'h2',
} : BannerProps) {
    const emphasisStyles = {
        high: 'bg-slate-50 pt-32 pb-20 border-b border-slate-200',
        medium: 'bg-white py-20 border-t border-b border-slate-200',
        low: 'bg-slate-100 py-12 rounded-2xl border border-slate-200',
      };
    
    return (
        <section
            aria-labelledby={id}
            className={`w-full flex flex-col items-center text-center px-6 ${emphasisStyles[emphasis]}`}
        >
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
                {/* Optional Eyebrown / Badge */}
                {badge && (
                    <span className="text-amber-700 font-bold tracking wider text-xs uppercase bg-amber-100 px-3 py-1 rounded-full">
                        {badge}
                    </span>
                )}
                {/* Heading */}
                <Typography
                    as={headingLevel}
                    variant= {headingLevel === 'h1'? 'h1' : 'h2'}
                    className="max-w-4xl"
                    id={id}
                >
                    {title}
                    {highlightText && (
                        <span className="text-amber-700 block mt-2">{highlightText}</span>
                    )}
                </Typography>

                {/* Body Description */}
                <Typography
                    as='p'
                    variant="body"
                    className="max-w-2xl text-lg text-slate-700"
                >
                    {description}
                </Typography>

                {/* Action button */}
                {actions.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                    {actions.map((action) => (
                      <Button
                        href={action.href}
                        variant={action.variant || 'primary'}
                        className="px-8 py-4 text-lg"
                      >
                        <span>{action.label}</span>
                        {action.showArrow && (
                          <span aria-hidden="true" className="ml-2">&rarr;</span>
                        )}
                      </Button>
                    ))}
                  </div>
                )}
            </div>
        </section>
    )
}