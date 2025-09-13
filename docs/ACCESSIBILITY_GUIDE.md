# Accessibility Guide

WealthTracker is committed to WCAG 2.1 AA compliance. This guide helps maintain accessibility standards across the application.

## Core Requirements

### Color & Contrast
- **Minimum contrast ratios:**
  - Normal text: 4.5:1
  - Large text (18pt+): 3:1
  - UI components: 3:1

**Use our accessible color classes:**
```tsx
// Good - accessible colors
<div className="text-gray-900 dark:text-white">
<button className="bg-blue-600 hover:bg-blue-700">

// Bad - low contrast
<div className="text-gray-400">
<button className="bg-gray-200 text-gray-500">
```

### Keyboard Navigation
**DO:**
- Ensure all interactive elements are keyboard accessible
- Provide visible focus indicators
- Support standard keyboard shortcuts (Tab, Shift+Tab, Enter, Escape)
- Implement skip links for main content

**DON'T:**
- Create keyboard traps
- Remove focus outlines without replacement
- Rely solely on hover states

### Screen Reader Support
**Required attributes:**
```tsx
// Buttons with icons need labels
<button aria-label="Delete transaction">
  <TrashIcon />
</button>

// Form fields need labels
<label htmlFor="amount">Amount</label>
<input id="amount" type="number" />

// Loading states need announcements
<div role="status" aria-live="polite">
  {loading && <span>Loading transactions...</span>}
</div>
```

### Touch Targets
- Minimum size: 44x44px on mobile
- Use TouchTarget component for small buttons:
```tsx
import TouchTarget from '../utils/touchTargets';

<TouchTarget onClick={handleClick}>
  <SmallIcon />
</TouchTarget>
```

## Testing Tools

### Automated Testing
```bash
# Run axe accessibility tests
npm run test:a11y

# Check specific component
import { axe } from '@axe-core/playwright';
```

### Manual Testing
1. **Keyboard only:** Navigate entire app without mouse
2. **Screen reader:** Test with NVDA (Windows) or VoiceOver (Mac)
3. **Zoom:** Test at 200% zoom level
4. **Color filters:** Test with grayscale/color blindness simulators

## Common Patterns

### Modals & Dialogs
```tsx
<dialog
  role="dialog"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-description">This action cannot be undone.</p>
</dialog>
```

### Error Messages
```tsx
<input
  aria-invalid={hasError}
  aria-describedby="error-message"
/>
{hasError && (
  <span id="error-message" role="alert">
    Amount is required
  </span>
)}
```

### Data Tables
```tsx
<table>
  <caption>Transaction History</caption>
  <thead>
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Amount</th>
    </tr>
  </thead>
</table>
```

## Axe Rules to Watch

Common violations and fixes:

1. **color-contrast**: Increase contrast ratios
2. **label**: Add labels to form inputs
3. **button-name**: Add aria-label to icon buttons
4. **region**: Use landmark regions (main, nav, aside)
5. **heading-order**: Keep h1→h2→h3 hierarchy

## Adding A11y Tests

Example test with React Testing Library:
```tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('should be accessible', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Axe DevTools Extension](https://www.deque.com/axe/devtools/)

## Questions?

Contact the team or refer to `src/components/common/Accessible*` components for implementation examples.