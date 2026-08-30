// components/system/Banner.tsx
import React from 'react';
import { Typography } from './typograph';
import { Button } from './button';
import { componentTokens } from './colorPalete';

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
  badge?: string;
  emphasis?: 'low' | 'medium' | 'high';
  headingLevel?: 'h1' | 'h2' | 'h3';
  themeMode?: 'light';
}

export function Banner({
  id,
  title,
  highlightText,
  description,
  actions,
  badge,
  emphasis = 'medium',
  headingLevel = 'h2',
  themeMode = 'light',
}: BannerProps) {
  // Structural spacing based on emphasis level
  const emphasisStyles = {
    high: 'pt-32 pb-20 border-b',
    medium: 'py-20 border-t border-b',
    low: 'py-12 rounded-2xl border',
  };

  const token = componentTokens.banner(themeMode);

  return (
    <section
      aria-labelledby={id}
      className={`w-full flex flex-col items-center text-center px-6 ${emphasisStyles[emphasis]}`}
      style={{
        borderColor: token.border[emphasis],
        backgroundColor: token.bg[emphasis],
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
        {/* Eyebrow / Badge */}
        {badge && (
          <span
            className="font-bold tracking-wider text-xs uppercase px-3 py-1 rounded-full"
            style={{
              backgroundColor: token.badgeBg,
              color: token.badgeText,
            }}
          >
            {badge}
          </span>
        )}

        {/* Heading */}
        <Typography
          as={headingLevel}
          variant={headingLevel === 'h1' ? 'h1' : 'h2'}
          className="max-w-4xl"
          id={id}
          themeMode={themeMode}
        >
          {title}
          {highlightText && (
            <span
              className="block mt-2"
              style={{ color: token.highlightText }}
            >
              {highlightText}
            </span>
          )}
        </Typography>

        {/* Body Description */}
        <Typography
          as="p"
          variant="body"
          className="max-w-2xl text-lg"
          themeMode={themeMode}
        >
          {description}
        </Typography>

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            {actions.map((action, index) => (
              <Button
                key={`${action.href}-${index}`}
                href={action.href}
                variant={action.variant || 'primary'}
                className="px-8 py-4 text-lg"
              >
                <span>{action.label}</span>
                {action.showArrow && (
                  <span aria-hidden="true" className="ml-2">
                    &rarr;
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}