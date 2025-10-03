# CLAUDE.md Review Tracker

Tracks improvements and learnings for the developer guide.

## Key Architectural Wins 🏆

### Transfer System Overhaul (2025-08-26)
**Insight**: "WealthTracker is for wealth management, not expense tracking"
- **Dynamic Categories**: Each account gets "To/From [Account]" category
- **Linked Transfers**: Automatic bidirectional transaction creation
- **Professional Metadata**: 20+ fields for fees, exchange rates, taxes, etc.
- **Transfer Center**: Command central dashboard for wealth movements

### Real-Time Sync Achievement (2025-08-23)
**Fixed**: Changes now instantly sync across browsers - TRUE "just works" experience
- Used database UUID not Clerk ID for subscriptions
- Enabled PostgreSQL real-time: `ALTER PUBLICATION supabase_realtime ADD TABLE accounts`
- Type conversion fix: 'current' (UK) ↔ 'checking' (US)

### Centralized ID Management (2025-08-25)
**Problem**: Clerk IDs vs Database UUIDs causing failures everywhere
**Solution**: Created `userIdService` and `useUserId` hook
- Single source of truth for ID conversions
- 5-minute caching reduces DB queries by 90%
- TypeScript types prevent mixing: `ClerkUserId` vs `DatabaseUserId`

### Sub-Agent System (2025-08-27)
**Innovation**: 8 specialized AI agents for deep expertise
- frontend, backend, security, database, performance specialists
- Orchestrator for complex multi-agent workflows
- Each enforces "top tier" standards in their domain

## Critical Lessons Learned 📚

### "Slower is Faster" Principle
**Evidence**: 5 minutes diagnosis saves 2+ hours of failed attempts
- **Subscription Fix**: 2 hours guessing vs 5 minutes checking constraints
- **Navigation Fix**: Removed feature without understanding context, had to rebuild

### Financial App Standards
- **ZERO unsafe optimizations** (removed all Terser unsafe flags)
- **Centralized database** required (localStorage = "looking like a joke")
- **Mathematical accuracy** paramount (use Decimal.js, not floats)

### Infrastructure vs UX Reality (2025-08-17)
**User Feedback**: "App looks great, functionality needs major improvement"
- Beautiful interfaces + poor functionality = failed UX
- Every feature must WORK before adding new ones
- Apply same rigor to UX as to code quality

## Testing & External Integration

### Demo Mode (2025-08-18)
**URL**: `https://wealthtracker-web.vercel.app/?demo=true`
- ChatGPT tests UI/UX → Claude implements fixes
- 100+ sample transactions, accounts, budgets
- Continuous improvement cycle

### Playwright Infrastructure (2025-08-20)
- Fixed auth with `demo=true` parameter
- 95% test pass rate achieved
- Add 2-3s wait times for React hydration
- Use direct navigation, not link clicking

## Technical Implementations

### Service Worker Development Fix
```javascript
const isDevelopment = url.hostname === 'localhost' && url.port === '5173';
if (isDevelopment) return; // Skip Vite requests
```

### Real-Time Subscription Pattern
```typescript
// CORRECT - Use database UUID
const dbUserId = await userIdService.getDatabaseUserId(clerkId);
const channel = supabase.channel(`realtime-${dbUserId}`)
  .on('postgres_changes', {
    filter: `user_id=eq.${dbUserId}` // Matches DB foreign key
  }, callback);
```

### Professional Icon System
- Migrated all 70+ icons to Tabler Icons
- Fixed modal centering with proper layout structure
- Changed from `h-screen` to `min-h-screen` for proper scrolling

## Performance Achievements

### Bundle Optimization (2025-08-16)
- 66% reduction: 234KB → 79KB gzipped
- Route-based code splitting
- Lazy-loaded charts (161KB separate chunk)

### Accessibility (2025-08-06)
- WCAG 2.1 AA compliance: 92/100 Lighthouse
- Color contrast fixes: Red #ef4444 → #dc2626
- All buttons have aria-labels
- 44px minimum touch targets

## Development Philosophy

### Quality Gates
1. **Visual Excellence** ✓
2. **Functional Excellence** ✓  
3. **User Journey Excellence** ✓
**Only when ALL THREE achieved = feature complete**

### Documentation Strategy
- Update existing docs > create new ones
- Code comments explain WHY not WHAT
- Create docs ONLY for complex multi-file features

## Current Status

### Strengths
- Professional infrastructure foundation
- Real-time sync working perfectly
- Robust test infrastructure (95% pass)
- Centralized ID management
- Sub-agent amplification system

### Focus Areas
- Functional excellence over new features
- Every existing feature must work flawlessly
- User workflows need validation
- Continue ChatGPT testing feedback cycle

## Quick Reference Commands

```bash
# Testing
npm test -- path/to/test.tsx --run
pkill -f vitest

# Demo Mode
https://wealthtracker-web.vercel.app/?demo=true

# Sub-Agents
cd ~/.claude/agents
node orchestrator.js interactive
```

---
*Last updated: 2025-08-27*
*Original: 1909 lines → Condensed: ~130 lines (93% reduction)*