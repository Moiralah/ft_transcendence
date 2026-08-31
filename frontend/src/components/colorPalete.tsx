// colorPalete.ts

import { FeaturesGrid } from "./featureGrid";

export const primitives = {
    slate: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
      950: '#020617',
    },
    amber: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309',
    },
    blue: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
    },
    red: {
      50: '#FEF2F2',
      500: '#EF4444',
      700: '#B91C1C',
    },
    emerald: {
      50: '#ECFDF5',
      500: '#10B981',
      700: '#047857',
    },
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
    whiteAlpha90: 'rgba(255, 255, 255, 0.9)',
  };
  
  export const semantics = {
    light: {
      surface: {
        footer: primitives.slate[900],
        navbar: primitives.whiteAlpha90,
        featuresGrid: primitives.white,
      },
      bg: {
        low: primitives.slate[100],
        medium: primitives.white,
        high: primitives.slate[50],
        badge: primitives.amber[100],
      },
      text: {
        muted: primitives.slate[300],
        primary: primitives.white,
        brandSecondary: primitives.amber[700],
        brandPrimary: primitives.slate[900],
        heading: primitives.slate[900],
        body: primitives.slate[600],
        caption: primitives.slate[600],
        badge: primitives.amber[700],
        highlight: primitives.amber[700],
        Card: primitives.amber[800],
      },
      border: {
        subtle: primitives.slate[800],
        navbar: primitives.slate[200],
        banner: primitives.slate[200],
        featureCard: primitives.slate[100],
      },
      interactive: {
        focusRing: primitives.amber[400],
        navRing: primitives.amber[700],
      },
    },
  };
  
  export const componentTokens = {
    footer: (themeMode: 'light') => {
      const s = semantics[themeMode] || semantics.light;
      return {
        bg: s.surface.footer,
        text: s.text.muted,
        linkHover: s.text.primary,
        border: s.border.subtle,
        focusRing: s.interactive.focusRing,
        focusOffset: s.surface.footer,
      };
    },
    navbar: (themeMode: 'light') => {
      const s = semantics[themeMode] || semantics.light;
      return {
        bg: s.surface.navbar,
        border: s.border.navbar,
        brand1: s.text.brandPrimary,
        brand2: s.text.brandSecondary,
        focusRing: s.interactive.navRing,
        focusOffset: s.surface.navbar,
      };
    },
    typograph: (themeMode: 'light') => {
      const s = semantics[themeMode] || semantics.light;
      return {
        h1: s.text.heading,
        h2: s.text.heading,
        h3: s.text.heading,
        body: s.text.body,
        caption: s.text.caption,
      };
    },
    banner: (themeMode: 'light') => {
      const s = semantics[themeMode] || semantics.light;
      return {
        border: {
          low: s.border.banner,
          medium: s.border.banner,
          high: s.border.banner,
        },
        bg: {
          low: s.bg.low,
          medium: s.bg.medium,
          high: s.bg.high,
        },
        badgeBg: s.bg.badge,
        badgeText: s.text.badge,
        highlightText: s.text.highlight,
      };
    },
    featuresGrid: (themeMode: 'light') => {
        const s = semantics[themeMode] || semantics.light;
        return {
            bg: s.surface.featuresGrid,
            bgCard: s.bg.high,
            bgCard2: s.bg.badge,
            text: s.text.Card,
            border: s.border.banner,
            borderCard: s.border.featureCard,
        };
    },
  };