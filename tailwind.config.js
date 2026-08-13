/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wealth/finance brand palette
        // `rgb(var(--…-rgb) / <alpha-value>)`, not `var(--color-primary)`.
        // Tailwind 3.4 cannot parse a bare var() as a colour, so it emitted NO
        // RULE for any opacity modifier on these two — `bg-primary/10` was
        // absent from the stylesheet and computed to transparent, taking
        // thirteen selected-state and hover tints with it, silently. The
        // alpha-value placeholder is how a CSS-variable token keeps its
        // modifiers; the variables themselves are defined in src/index.css,
        // which derives the plain colour form from the same triple so the
        // fifty-four raw `var(--color-primary)` readers are untouched.
        primary: 'rgb(var(--color-primary-rgb, 26 35 50) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary-rgb, 45 58 77) / <alpha-value>)',
        // Gold is a FILL colour only (chips, marks, the yellow thread's box).
        // As text on white it measures 2.21:1 — that is what accent-text is
        // for. (DESIGN_PASS_2026-08 §2.1, instrumented 2026-08-12.)
        accent: '#d4a843',
        'accent-text': '#8a6a19', // 5.05:1 on #fff, 4.80:1 on #f8f9fb
        'navy-400': '#6B86B3', // selection ring, R marker

        // Surface colors
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8f9fb',
          tertiary: '#f1f3f7',
        },

        // WCAG AA compliant card backgrounds
        'card-bg': {
          light: '#f1f3f7',
          DEFAULT: '#ffffff',
          dark: '#1f2937',
        },

        // Accessible text colors
        'card-text': {
          light: '#64748b',
          DEFAULT: '#1a2332',
        },

        // Financial semantic colors — every text pair here is pinned ≥4.5:1 by
        // src/design-system/__tests__/semantic-contrast.test.ts, measured with
        // the repo's own harness, on BOTH light surfaces (#fff cards and the
        // #f8f9fb page). income-fill is the brighter chart/series green; it is
        // not a text colour (3.38:1 on white — passes only the 3:1 graphics
        // bar, which is all a chart series needs).
        income: '#0a7d57', // 5.14:1 on #fff (was #0d9f6f, 3.38:1)
        'income-fill': '#0d9f6f', // chart series only
        expense: '#c9304a', // 5.24:1 on #fff (was #d94052, 4.37:1)
        success: '#0a7d57',
        danger: '#c9304a',
        warning: '#e5a00d',

        // Hairlines (DESIGN_PASS §2.2) — the border that replaces shadows.
        line: {
          DEFAULT: '#e2e6ed',
          strong: '#cdd4e0',
          // The quietest of the three, for a rule REPEATED down a dense list:
          // forty of #e2e6ed between register rows reads as a grid, which is
          // the chrome the register is losing. (DESIGN_PASS §3.1.)
          soft: '#eef1f6',
        },

        // Navigation
        nav: {
          bg: '#1a2332',
          text: '#94a3b8',
          active: '#ffffff',
          hover: '#2d3a4d',
        },

        // UI control colors (navy scheme; ui-add stays green as a semantic
        // "add/positive" accent)
        'ui-bg': '#2d3a4d',
        'ui-control': '#1a2332',
        'ui-control-hover': '#2d3a4d',
        'ui-add': '#0d9f6f',
        'ui-add-hover': '#0b8a5f',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      // The design pass's six-step type scale (DESIGN_PASS §2.3). The named
      // sizes are the vocabulary later batches adopt surface by surface; the
      // 2xl/3xl/4xl redefinitions keep Tailwind's default sizes but add the
      // optical tracking large Inter needs — that part lands everywhere now.
      fontSize: {
        label: ['11px', { lineHeight: '16px', letterSpacing: '0.07em' }],
        dense: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '20px' }],
        card: ['16px', { lineHeight: '22px' }],
        page: ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        display: ['32px', { lineHeight: '36px', letterSpacing: '-0.03em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.03em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }],
      },
      // 6 controls · 8 cards · 10 modals (DESIGN_PASS §2.5). DEFAULT moves
      // 4→6 and xl 12→10; md/lg restate Tailwind's own values so the whole
      // scale reads in one place.
      borderRadius: {
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '10px',
      },
      // The only two shadows with a meaning: overlays float, the selected row
      // lifts. Everything else is a hairline border's job.
      boxShadow: {
        overlay: '0 8px 24px -8px rgb(26 35 50 / 0.18)',
        row: '0 1px 3px rgb(26 35 50 / 0.10)',
      },
      transitionDuration: {
        state: '120ms',
        enter: '200ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'zoom-in-95': {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-in-from-bottom-4': {
          '0%': { transform: 'translateY(1rem)' },
          '100%': { transform: 'translateY(0)' },
        },
        // A pinned dashboard card re-stating itself when the PAGE clock moves
        // (components/dashboard/reportWidgets/CardPeriodControl). One quiet
        // blink, so a card that deliberately did not follow is SEEN not to have
        // followed rather than appearing to be stuck.
        //
        // Opacity only, on purpose: no colour, because amber is reserved for
        // things that are actually wrong (P3) and a window the user chose is
        // not one of them; and no transform, because a marker that moves is a
        // layout shift charged to every neighbour on the row.
        'pin-ack': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
      },
      animation: {
        'in': 'fade-in 0.2s ease-out, zoom-in-95 0.2s ease-out, slide-in-from-bottom-4 0.2s ease-out',
        // The ONLY animation a skeleton gets (DESIGN_PASS §4): it fades in
        // once and then holds still. Named rather than written inline so the
        // 200ms is the same 200ms as the delay that decides to show it.
        'fade-in': 'fade-in 200ms ease-out',
        // The `enter` duration (200ms), because this is an arrival: the marker
        // re-states itself rather than changing state. It runs ONCE per move of
        // the page clock, and the element clears the class on `animationend` —
        // which still fires under prefers-reduced-motion, where index.css
        // shortens animations to 0.01ms rather than removing them.
        'pin-ack': 'pin-ack 200ms ease-out',
      },
    },
  },
  plugins: [],
}
