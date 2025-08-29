# WealthTracker AI Assistant Guide

## PROJECT VISION
**Goal**: #1 Professional Personal Finance App - Market leader with Apple-level "just works" reliability
**Model**: Subscription SaaS, multi-tenant cloud architecture
**Standards**: Professional-grade, zero compromises, best-in-class implementation

## TECH STACK
- **Frontend**: React + TypeScript + Vite + Redux Toolkit + TailwindCSS
- **Testing**: Vitest + React Testing Library (use `--run` flag always)
- **Features**: PWA, offline-first, WCAG 2.1 AA compliant
- **Security**: XSS protection, encrypted storage, sanitized inputs

## CRITICAL PRINCIPLES

### 0. Professional Excellence
- Never guess - verify everything
- No "good enough" - only best-in-class
- Complete, polished, production-ready code
- Financial software = ZERO tolerance for errors

### 1. Read First, Code Second
```bash
# Always in this order:
1. Read implementation with Read/Grep/Glob tools
2. Understand actual behavior (not assumptions)
3. Follow existing patterns
4. Then implement
```

### 2. "Slower is Faster" Principle
**Real evidence**: 5 minutes diagnosis saves 2+ hours of failed attempts

**STOP when you see**:
- Multiple failed attempts
- Considering workarounds
- Words like "just", "quick", "bypass"
- Tempted to disable features

**Instead**: STOP → READ → UNDERSTAND → DIAGNOSE → THINK → PLAN → IMPLEMENT

### 3. Functional Excellence Before Expansion
- Every feature must WORK before adding new ones
- Visual + Functional + User Journey = Complete feature
- "Beautiful but broken" = failed professional standards

### 4. Financial Software Standards
- NO unsafe math optimizations
- NO floating-point for money (use Decimal.js or strings)
- ALL amounts follow strict display rules:
  - Expenses: `-£100.00` (red)
  - Income: `+£100.00` (green)
  - Liabilities stay negative

### 5. CRITICAL: No Half-Implemented Features
**ABSOLUTE RULE**: If you start it, you FINISH it completely:
- UI changes REQUIRE backend implementation
- Backend changes REQUIRE UI connection
- Database changes REQUIRE service layer updates
- Type changes REQUIRE full implementation
See CLAUDE_REQUIREMENTS.md for mandatory checklist

### 6. Key Architecture Patterns

#### Component Structure
```typescript
export default function ComponentName({ props }: Props): React.JSX.Element {
  // Hooks first
  const { data } = useApp();
  
  // Handlers
  const handleAction = (): void => { };
  
  // Render
  return <div className="tailwind-classes">{/* JSX */}</div>;
}
```

#### Testing Pattern
```typescript
import { describe, it, expect, vi } from 'vitest';
// Always mock with vi, not jest
// Always use --run flag
```

#### ID Management (Critical)
```typescript
// NEVER mix Clerk IDs with DB queries
import { userIdService } from '../services/userIdService';

// Convert Clerk → Database UUID
const dbUserId = await userIdService.getDatabaseUserId(clerkId);
```

## COMMON ISSUES & SOLUTIONS

### Import/Export Errors
```typescript
// Check actual export type
export default Component  // → import Component
export { Component }       // → import { Component }
```

### Test Failures
- Read actual implementation first
- Check static vs instance methods
- Verify data formats (string "100.50" not number 100.50)
- Use regex for partial matches: `/Date/` not `'Date'`

### Database Issues
```sql
-- ALWAYS check constraints first
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint WHERE conrelid = 'table_name'::regclass;
```

## DEVELOPMENT WORKFLOW

### Bug Fixes
1. Reproduce → Read implementation → Identify root cause → Fix systematically → Verify

### New Features  
1. Study patterns → Follow conventions → Test first → Implement incrementally → Test thoroughly

### Documentation
- Update CLAUDE_REVIEW.md after sessions
- Create new docs ONLY for complex multi-file features
- Code comments explain WHY not WHAT

## EXTERNAL TESTING
**Demo Mode**: `https://wealthtracker-web.vercel.app/?demo=true`
- ChatGPT tests → You fix → Deploy → Repeat

## KEY PATTERNS

### Desktop-First
- Primary platform = desktop
- Mobile = companion app
- Use `useDeviceType` hook

### Performance
- Bundle <200KB gzipped
- Lazy load heavy components
- Test in production mode (`npm run build`)

### Security
```typescript
import { sanitizeText, sanitizeNumber } from '../security/xss-protection';
const clean = sanitizeText(userInput);
```

## PROJECT STRUCTURE
```
src/
  components/     # UI components
  contexts/       # AppContext, etc.
  hooks/          # Custom hooks
  pages/          # Page components
  services/       # Business logic
  store/          # Redux
  utils/          # Helpers
```

## TESTING COMMANDS
```bash
npm test -- path/to/test.tsx --run  # Single test
pkill -f vitest                      # Kill stuck processes
```

## MOBILE PATTERNS
- Touch targets: min 44x44px
- Responsive classes: `p-3 sm:p-4 md:p-6`
- Tables → Cards on mobile

## GOTCHAS
1. Service Worker: Test offline after changes
2. Bundle size: Monitor with `npm run build`
3. Test runner: Always use `--run` flag
4. Financial display: Use formatCurrency() consistently
5. Chrome extensions can affect Lighthouse scores

## SUB-AGENT SYSTEM
Specialized agents in `~/.claude/agents/`:
- frontend-specialist, backend-specialist, security-specialist, etc.
- Use for deep domain expertise while maintaining standards

## THE BOTTOM LINE
**Quality over speed. Understanding over guessing. Professional excellence in every line.**

This is a professional financial application - code like people's money depends on it, because it does.

---
*Last updated: 2025-08-27*
*Original size: 1690 lines → Optimized: ~150 lines (91% reduction)*