## Summary

- [ ] Purpose of this PR is clearly described

## Quality Checklist

- [ ] No `console.log` in `src/**` (non-test, non-mocks); use `logger` instead
- [ ] No direct imports from forbidden libs
  - [ ] `@tabler/icons-react` (use `src/components/icons` facade)
  - [ ] `lucide-react`
  - [ ] `react-chartjs-2` / `chart.js` / `plotly*`
- [ ] Bundle size budget passes (`npm run bundle:check`)
- [ ] Types pass (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] Unit/Integration tests pass locally (if affected)

## Security & PII

- [ ] No secrets or tokens added to code or `.env`
- [ ] Inputs sanitized where applicable

## Screenshots / Notes

- Add before/after screenshots or notes if UI changes are relevant.

