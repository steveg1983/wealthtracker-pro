# Manual Testing Guide for WealthTracker

## Overview

This guide provides detailed instructions for completing the remaining manual testing tasks. These tests require human interaction and cannot be fully automated.

## 1. Screen Reader Testing

### Prerequisites

#### Windows
- **NVDA** (Free): https://www.nvaccess.org/download/
- **JAWS** (Commercial): https://www.freedomscientific.com/products/software/jaws/

#### macOS
- **VoiceOver** (Built-in): System Preferences > Accessibility > VoiceOver

#### Linux
- **Orca** (Free): Pre-installed on most distributions

### Testing Checklist

#### Global Navigation
- [ ] Tab through all navigation elements
- [ ] Verify skip links work (press Tab once after page load)
- [ ] Check landmark navigation (NVDA: D key, VoiceOver: VO+U)
- [ ] Verify breadcrumb navigation is announced correctly

#### Forms
Test each form in the application:

**Add Transaction Modal**
- [ ] Form title is announced when opened
- [ ] Each field label is read when focused
- [ ] Required fields are announced as required
- [ ] Error messages are announced when validation fails
- [ ] Success message is announced after submission

**Account Settings**
- [ ] Account type dropdown options are readable
- [ ] Currency selector announces selected currency
- [ ] Balance input field announces current value

**Budget Creation**
- [ ] Category selector is navigable
- [ ] Amount fields announce their purpose
- [ ] Period selector (monthly/yearly) is clear

#### Data Tables
- [ ] Table headers are announced when navigating columns
- [ ] Row headers (if any) are announced
- [ ] Empty states have descriptive text
- [ ] Sort buttons indicate current sort state

#### Interactive Elements
- [ ] Buttons announce their purpose
- [ ] Toggle switches announce on/off state
- [ ] Modal dialogs trap focus correctly
- [ ] Tooltips are readable (if keyboard accessible)

#### Charts and Visualizations
- [ ] Charts have text alternatives
- [ ] Data points can be accessed via keyboard
- [ ] Summary information is available in text

### Common Issues to Check

1. **Missing Labels**
   ```html
   <!-- Bad -->
   <input type="text" placeholder="Enter amount">
   
   <!-- Good -->
   <label htmlFor="amount">Amount</label>
   <input id="amount" type="text" placeholder="Enter amount">
   ```

2. **Button Context**
   ```html
   <!-- Bad -->
   <button>Delete</button>
   
   <!-- Good -->
   <button aria-label="Delete transaction">Delete</button>
   ```

3. **Dynamic Content**
   - Verify live regions announce changes
   - Check that loading states are announced
   - Ensure error messages are immediately announced

### Screen Reader Commands Reference

#### NVDA (Windows)
- **Start/Stop**: Ctrl + Alt + N
- **Read all**: NVDA + Down Arrow
- **Next heading**: H
- **Next landmark**: D
- **Forms mode**: NVDA + Space
- **Navigate tables**: Ctrl + Alt + Arrow keys

#### VoiceOver (macOS)
- **Start/Stop**: Cmd + F5
- **Read all**: VO + A
- **Next heading**: VO + Cmd + H
- **Rotor**: VO + U
- **Navigate**: VO + Arrow keys

## 2. Color Contrast Testing

### Tools Required

1. **Browser Extensions**
   - WAVE (WebAIM): https://wave.webaim.org/extension/
   - Axe DevTools: https://www.deque.com/axe/devtools/
   - Lighthouse (Chrome built-in)

2. **Desktop Applications**
   - Colour Contrast Analyser: https://www.tpgi.com/color-contrast-checker/
   - Stark (Figma/Sketch plugin)

### WCAG 2.1 Requirements

- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18pt or 14pt bold): 3:1 contrast ratio
- **UI components**: 3:1 contrast ratio
- **Graphics**: 3:1 contrast ratio

### Testing Checklist

#### Text Contrast
- [ ] Primary text (#1f2937) on white background
- [ ] Primary text on gray backgrounds
- [ ] White text on blue headers (#8EA9DB)
- [ ] Error text (red) on light backgrounds
- [ ] Success text (green) on light backgrounds
- [ ] Disabled text maintains 3:1 ratio

#### Interactive Elements
- [ ] Button text on button backgrounds
- [ ] Link text (standard and hover states)
- [ ] Form input text and placeholders
- [ ] Selected tab indicators
- [ ] Focus indicators (should be 3:1 against adjacent colors)

#### Data Visualization
- [ ] Chart colors against backgrounds
- [ ] Legend text readability
- [ ] Grid lines visibility

#### Dark Mode
Test all above items in dark mode:
- [ ] Adjust the testing for dark backgrounds
- [ ] Verify sufficient contrast is maintained
- [ ] Check that colors don't become too bright/harsh

### Manual Testing Process

1. **Using Browser DevTools**
   ```javascript
   // Paste in console to get computed colors
   const element = document.querySelector('.your-selector');
   const styles = window.getComputedStyle(element);
   console.log('Color:', styles.color);
   console.log('Background:', styles.backgroundColor);
   ```

2. **Using Color Contrast Analyser**
   - Use the eyedropper to select foreground color
   - Use the eyedropper to select background color
   - Verify the ratio meets requirements

3. **Common Problem Areas**
   - Placeholder text (often too light)
   - Disabled states (must still be perceivable)
   - Links in different contexts
   - White text on colored backgrounds
   - Focus indicators

### Specific Areas to Test

1. **Financial Data Display**
   - Red text for negative amounts
   - Green text for positive amounts
   - Ensure both meet contrast requirements

2. **Table Headers**
   - White text on #8EA9DB background
   - Already implemented but verify 4.5:1 ratio

3. **Status Indicators**
   - Success messages (green)
   - Error messages (red)
   - Warning messages (yellow/orange)
   - Info messages (blue)

4. **Charts**
   - Each data series color
   - Verify patterns/textures for colorblind users

## 3. Keyboard Navigation Testing

### Complete Navigation Flow

1. **Start at URL bar**
2. **Tab through entire page**
3. **Document any issues**:
   - Elements that can't be reached
   - Elements that trap focus
   - Illogical tab order
   - Missing focus indicators

### Key Combinations to Test

- **Tab**: Forward navigation
- **Shift+Tab**: Backward navigation
- **Enter**: Activate buttons/links
- **Space**: Toggle checkboxes, activate buttons
- **Arrow Keys**: Navigate within components
- **Escape**: Close modals/dropdowns

## 4. Mobile Accessibility Testing

### iOS VoiceOver
1. Settings > Accessibility > VoiceOver
2. Triple-click side button to toggle
3. Swipe right/left to navigate
4. Double-tap to activate

### Android TalkBack
1. Settings > Accessibility > TalkBack
2. Volume key shortcut to toggle
3. Swipe right/left to navigate
4. Double-tap to activate

## Reporting Issues

When you find an issue, document:

1. **Location**: Exact page and component
2. **Issue Type**: Missing label, low contrast, etc.
3. **Current Behavior**: What happens now
4. **Expected Behavior**: What should happen
5. **Severity**: Critical, Major, Minor
6. **Screenshot**: If applicable

### Issue Template
```markdown
## Accessibility Issue

**Location**: Dashboard > Add Transaction Modal > Amount Field
**Type**: Missing Label
**Current**: Screen reader announces "Edit text"
**Expected**: Screen reader should announce "Transaction amount, required"
**Severity**: Major
**Notes**: Placeholder text is not sufficient for screen readers
```

## Automated Testing Helpers

Before manual testing, run automated checks:

```bash
# Run the accessibility audit
npm run audit:accessibility

# Check specific pages
npm run lighthouse -- --url=http://localhost:5173/dashboard
```

## Success Criteria

### Screen Reader Testing
- All interactive elements are accessible
- All content is readable
- Navigation is logical and efficient
- Form errors are announced
- Dynamic updates are communicated

### Color Contrast Testing
- All text meets WCAG 2.1 AA standards
- UI components have sufficient contrast
- Focus indicators are clearly visible
- Information isn't conveyed by color alone

## Next Steps

After completing manual testing:

1. Fix any critical issues immediately
2. Document minor issues for future updates
3. Consider user testing with actual users with disabilities
4. Set up monitoring for regression prevention

Remember: Accessibility is an ongoing process, not a one-time checklist!