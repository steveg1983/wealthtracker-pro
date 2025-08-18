# Accessibility Testing Quick Start

## 🚀 Getting Started

### 1. Run Automated Checks First
```bash
# Make sure dev server is running
npm run dev

# In another terminal, run the accessibility check
node scripts/check-accessibility.js
```

### 2. Open the Test Results Document
Open `ACCESSIBILITY_TEST_RESULTS.md` and use it to track your manual testing.

## 🔍 Priority Testing Areas

### Critical Components to Test

#### 1. Add Transaction Modal (Most Complex Form)
**Why**: This is the most frequently used form with multiple validation states

**Screen Reader Test**:
- Press "Add Transaction" button
- Verify modal title is announced
- Tab through type buttons - verify aria-pressed states work
- Test each field - verify labels are announced
- Submit with errors - verify errors are announced immediately
- Submit successfully - verify success message

**Color Contrast**:
- Red expense button
- Green income button
- Error messages (red text)
- Form labels

#### 2. Financial Amounts Display
**Why**: Custom formatting with color coding needs verification

**Screen Reader Test**:
- Navigate to transactions list
- Verify negative amounts are announced with minus sign
- Verify positive amounts are announced clearly

**Color Contrast**:
- Red text for negative amounts (#ef4444 on white)
- Green text for positive amounts (#10b981 on white)
- Should be 4.5:1 ratio minimum

#### 3. Table Headers
**Why**: White text on blue background (#8EA9DB) is a known risk area

**Color Contrast**:
- Check all table headers
- Should have 4.5:1 ratio
- Test in both light and dark modes

#### 4. Skip Links
**Why**: Essential for keyboard navigation

**Keyboard Test**:
- Load any page
- Press Tab once
- Skip links should appear
- Press Enter to activate
- Focus should jump to main content

## 📋 Quick Checklist

### Screen Reader (10 minutes)
- [ ] Can create a transaction from start to finish
- [ ] All form errors are announced
- [ ] Modal titles are announced
- [ ] Financial amounts read correctly
- [ ] Navigation menu items are clear

### Keyboard Navigation (5 minutes)
- [ ] Tab through entire dashboard
- [ ] Skip links work (first tab)
- [ ] Can open/close modals with keyboard
- [ ] No keyboard traps
- [ ] ESC closes modals

### Color Contrast (5 minutes)
Using browser DevTools or contrast checker:
- [ ] Red amounts: #ef4444 on #ffffff (should be ~4.3:1) ⚠️
- [ ] Green amounts: #10b981 on #ffffff (should be ~5.9:1) ✅
- [ ] White on blue headers: #ffffff on #8EA9DB (should be ~2.1:1) ❌
- [ ] Primary button text
- [ ] Form labels

## 🛠 Tools

### Quick Browser Tools
1. **Chrome DevTools**:
   - Right-click element > Inspect
   - Click color square in styles
   - Shows contrast ratio immediately

2. **WAVE Extension**:
   - One-click full page scan
   - Visual indicators on page
   - Detailed error explanations

### Screen Readers
- **Windows**: NVDA (free, quick to learn)
- **Mac**: VoiceOver (Cmd+F5 to toggle)

## 🚨 Known Issues to Verify

Based on code review, these areas may have issues:

1. **Table Headers** - White text on #8EA9DB likely fails contrast
2. **Red Amount Text** - May be borderline for contrast
3. **Focus Indicators** - Some custom focus styles may not be visible enough
4. **Loading States** - PageLoader component missing aria-label

## 📝 Reporting Template

When you find an issue:

```markdown
**Issue**: [Brief description]
**Location**: [Page] > [Component]
**Severity**: Critical/Major/Minor
**Details**: [What happens vs what should happen]
**Fix**: [Suggested solution]
```

## ⏱ Time Estimate

- Automated check: 2 minutes
- Critical manual testing: 20 minutes
- Full manual testing: 45-60 minutes
- Report writing: 15 minutes

**Total: ~40 minutes for essential testing**

## 🎯 Success Criteria

You can consider the app accessible when:
1. All critical user flows work with screen reader
2. No keyboard traps exist
3. All text meets WCAG AA contrast (4.5:1)
4. Errors are announced immediately
5. Focus management is logical

Start with the automated check, then focus on the Add Transaction Modal as it covers most patterns used throughout the app!