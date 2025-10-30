# WealthTracker Shared Packages

This workspace directory will host reusable modules shared across apps:
- `config/` – lint, TypeScript, Vite/Vitest presets
- `core/` – domain and financial logic
- `ui/` – design system and shared components
- `types/` – cross-platform TypeScript declarations
- `utils/` – platform-neutral utilities
- `testing/` – test harnesses, mocks, fixtures
- `tooling/` – scripts, codemods, generators

Populate each package with its own `package.json` as extraction progresses.
