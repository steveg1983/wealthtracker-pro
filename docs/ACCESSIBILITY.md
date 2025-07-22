# Accessibility Guidelines for WealthTracker

## Overview

WealthTracker is committed to providing an accessible financial management experience for all users, including those who rely on assistive technologies. This document outlines our accessibility standards and implementation guidelines.

## WCAG 2.1 Compliance

We aim to meet WCAG 2.1 Level AA standards across the application.

## Key Accessibility Features

### 1. Skip Navigation
- **Implementation**: Skip link in Layout component
- **Location**: `/src/components/Layout.tsx`
- **Usage**: Allows keyboard users to skip repetitive navigation

### 2. Focus Management
- **Modal Focus Trap**: Implemented in `/src/components/common/Modal.tsx`
- **Focus Restoration**: Returns focus to triggering element when modals close
- **Utilities**: `useFocusTrap` and `useFocusRestore` hooks in `/src/utils/accessibility.ts`

### 3. ARIA Labels and Roles
- All interactive elements have descriptive aria-labels
- Tables use proper semantic markup with roles
- Form inputs have associated labels
- Status messages use ARIA live regions

### 4. Keyboard Navigation
- All interactive elements are keyboard accessible
- Tab order follows logical flow
- Custom keyboard shortcuts documented
- Sortable table columns support Enter/Space keys

### 5. Screen Reader Support
- **AriaLiveRegion Component**: `/src/components/common/AriaLiveRegion.tsx`
- Dynamic content changes announced
- Charts provide text alternatives
- Complex data visualizations include table views

## Component Guidelines

### Forms
Use the `AccessibleFormField` component for consistent accessibility:

```typescript
import { AccessibleFormField } from './components/common/AccessibleFormField';

<AccessibleFormField
  label="Transaction Amount"
  type="number"
  value={amount}
  onChange={setAmount}
  error={validationError}
  hint="Enter the transaction amount"
  required
/>
```

### Tables
Use the `AccessibleTable` component or follow this pattern:

```typescript
<table role="table" aria-label="Financial transactions">
  <caption className="sr-only">Descriptive caption for screen readers</caption>
  <thead>
    <tr role="row">
      <th scope="col" role="columnheader" aria-sort="ascending">Date</th>
      <th scope="col" role="columnheader">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr role="row">
      <td role="cell">2024-01-20</td>
      <td role="cell">Grocery shopping</td>
    </tr>
  </tbody>
</table>
```

### Buttons
Always provide meaningful labels:

```typescript
// Icon-only buttons MUST have aria-label
<IconButton
  icon={<EditIcon />}
  onClick={handleEdit}
  aria-label="Edit transaction"
  title="Edit"
/>

// Text buttons should have descriptive text
<button onClick={handleSave}>
  Save Transaction
</button>
```

### Charts and Visualizations
Provide text alternatives:

```typescript
<div role="img" aria-label={chartDescription}>
  <PieChart data={data} />
</div>

// Include a data table option
<details>
  <summary>View data in table format</summary>
  <table>
    {/* Tabular representation of chart data */}
  </table>
</details>
```

## Color and Contrast

### Color Usage
- Never rely solely on color to convey information
- Use icons, text, or patterns in addition to color
- Example: Status indicators use both color and text/icons

### Contrast Ratios
- Normal text: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- Interactive elements: 3:1 minimum against adjacent colors

## Testing

### Manual Testing
1. **Keyboard Navigation**
   - Tab through entire application
   - Test all interactive elements
   - Verify focus indicators are visible

2. **Screen Reader Testing**
   - Test with NVDA (Windows)
   - Test with JAWS (Windows)
   - Test with VoiceOver (macOS/iOS)
   - Test with TalkBack (Android)

3. **Browser Extensions**
   - axe DevTools
   - WAVE (WebAIM)
   - Lighthouse (Chrome DevTools)

### Automated Testing
```bash
# Run accessibility tests
npm run test:a11y

# Check specific component
npm run test:a11y -- ComponentName
```

## Common Patterns

### Loading States
```typescript
<div role="status" aria-live="polite">
  <span className="sr-only">Loading transactions...</span>
  <LoadingSpinner aria-hidden="true" />
</div>
```

### Error Messages
```typescript
<div role="alert" aria-live="assertive">
  <p id="error-message">{error}</p>
</div>

<input aria-describedby="error-message" aria-invalid="true" />
```

### Dynamic Content Updates
```typescript
import { useAriaAnnounce } from '../utils/accessibility';

const { announce, AriaAnnouncer } = useAriaAnnounce();

// When content updates
announce('5 new transactions added');

// In your component
<AriaAnnouncer />
```

## Utilities

### Available Utilities
Located in `/src/utils/accessibility.ts`:

- `announceToScreenReader(message, priority)` - Announce messages
- `useFocusTrap(isActive)` - Trap focus within an element
- `useFocusRestore(isActive)` - Restore focus when closing
- `generateId(prefix)` - Generate unique IDs for form elements
- `getAriaLabelForCurrency(amount, currency)` - Format currency for screen readers
- `getAriaLabelForDate(date)` - Format dates for screen readers
- `prefersReducedMotion()` - Check user's motion preference

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Checklist for New Features

- [ ] All interactive elements are keyboard accessible
- [ ] Form inputs have associated labels
- [ ] Images have appropriate alt text
- [ ] Color is not the only way to convey information
- [ ] Focus indicators are visible
- [ ] ARIA labels describe the purpose of elements
- [ ] Dynamic content updates are announced
- [ ] Error messages are associated with form fields
- [ ] Tables have proper semantic markup
- [ ] Charts have text alternatives
- [ ] Component tested with keyboard only
- [ ] Component tested with screen reader
- [ ] No accessibility errors in automated testing