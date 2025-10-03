# Feature Implementation Requirements

## MANDATORY COMPLETION CHECKLIST
Every feature MUST have ALL of these before marking as "complete":

### 1. Database Layer ✓
- [ ] Database schema/migrations created
- [ ] Tested on local database
- [ ] Migration documented for production

### 2. Backend Services ✓
- [ ] Service/API layer implemented
- [ ] CRUD operations complete
- [ ] Error handling in place

### 3. Frontend Implementation ✓
- [ ] UI components updated
- [ ] State management connected
- [ ] User interactions working

### 4. Integration ✓
- [ ] Frontend connected to backend
- [ ] Data flow verified end-to-end
- [ ] Real-time updates working (if applicable)

### 5. Testing ✓
- [ ] Local testing passed
- [ ] Edge cases handled
- [ ] Error states managed

### 6. Deployment ✓
- [ ] Build succeeds
- [ ] Production migration plan documented
- [ ] Deployment verified

## INCOMPLETE FEATURES TRACKING

### ⚠️ NEVER LEAVE THESE HALF-DONE:
1. **If you update UI to expect data** → Backend MUST provide that data
2. **If you add database fields** → Services MUST use those fields
3. **If you create services** → UI MUST consume them
4. **If you add configuration** → Implementation MUST use it

## CURRENT INCOMPLETE FEATURES
(Track any partially implemented features here)

- None currently (after categories fix)

## IMPLEMENTATION PRINCIPLES

### The "Full Stack or No Stack" Rule
- NEVER commit UI changes without backend support
- NEVER add database fields without service layer updates
- NEVER update types/interfaces without implementation

### The "Test Before Marking Done" Rule
1. Create a test account/record
2. Perform the action
3. Verify the result
4. Delete test data
5. Only then mark as complete

### The "Document the Gap" Rule
If you MUST leave something incomplete:
1. Add it to "CURRENT INCOMPLETE FEATURES" above
2. Add TODO comments in code
3. Notify in commit message
4. Create an issue/task to complete it

## RED FLAGS TO WATCH FOR

These phrases indicate incomplete implementation:
- "This will be implemented later"
- "TODO: Add backend support"
- "Temporarily using mock data"
- "Will be connected in next update"
- "Placeholder implementation"

## VERIFICATION COMMANDS

Run these before considering any feature complete:

```bash
# Check for TODO comments
grep -r "TODO" src/ --include="*.ts" --include="*.tsx"

# Check for unimplemented functions
grep -r "throw.*not implemented" src/

# Check for console warnings about missing data
npm run dev # Then check browser console

# Verify build
npm run build

# Check TypeScript errors
npm run typecheck
```

## COMMIT MESSAGE FLAGS

Use these in commit messages to indicate completeness:

- `[COMPLETE]` - Feature is 100% implemented and tested
- `[PARTIAL]` - Feature is partially implemented (MUST list what's missing)
- `[UI-ONLY]` - Only UI implemented, needs backend
- `[BACKEND-ONLY]` - Only backend implemented, needs UI
- `[NEEDS-MIGRATION]` - Requires database migration in production

Example:
```
feat: [PARTIAL] Add category management - UI complete, needs backend service
```

---

**Remember**: It's better to not start a feature than to leave it half-done. 
Half-implemented features are technical debt that compounds quickly.