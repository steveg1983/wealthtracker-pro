# Pull Request Checklist

Before submitting a PR, ensure all items are checked:

## Build & Tests
- [ ] `npm run build:check` passes without errors
- [ ] `npm run lint` shows zero errors
- [ ] `npm test` passes all tests
- [ ] New features include tests

## Code Quality
- [ ] No `as any` type assertions
- [ ] No `@ts-ignore` comments
- [ ] No `as unknown as` double casts
- [ ] Proper error handling for all user actions
- [ ] Financial calculations use Decimal.js

## Bundle Size
- [ ] Bundle size increase < 5KB for features
- [ ] Large dependencies are lazy-loaded
- [ ] Images are optimized (WebP format preferred)

## Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader tested
- [ ] Color contrast ratios meet standards
- [ ] Touch targets ≥ 44x44px on mobile

## Security
- [ ] No secrets/API keys in code
- [ ] Input validation implemented
- [ ] XSS protection verified
- [ ] No console.log statements

## Small PR Policy
- [ ] PR changes < 300 lines (excluding tests/docs)
- [ ] Single focused feature/fix
- [ ] No unrelated "drive-by" fixes
- [ ] Clear PR title and description

## Documentation
- [ ] JSDoc/TSDoc for public APIs
- [ ] README updated if needed
- [ ] CHANGELOG entry added

## Final Checks
- [ ] Self-reviewed the changes
- [ ] Tested in production mode (`npm run build && npm run preview`)
- [ ] Tested on mobile devices
- [ ] No commented-out code
- [ ] No .backup files created