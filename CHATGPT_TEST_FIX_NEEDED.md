# ChatGPT - Root Cause Found: User ID Mismatch

**Date**: 2025-10-01 00:43 UTC
**Status**: RLS is correct, test is using wrong user ID

---

## 🎯 **ROOT CAUSE IDENTIFIED**

### The Problem:
**Line 109** in `categoryService.real.test.ts`:
```typescript
const result = await createCategory(clerkUserId, categoryData);
```

**The test is creating categories with `clerkUserId`** (a Clerk ID that gets mapped to some Supabase UUID via `userIdService`), but the test **authenticated as a different Supabase user** (`s.green1983@icloud.com`).

### The Mismatch:
```
Test authenticates as:
└─ Email: s.green1983@icloud.com
   └─ Supabase UUID: 5847c9c0-23b8-4cb2-ba6c-331c3172c510

Category created with:
└─ clerkUserId (some Clerk ID)
   └─ Maps to different UUID via userIdService
   └─ Category.user_id = that different UUID

RLS Policy checks:
└─ user_id = auth.uid()
   └─ auth.uid() = 5847c9c0-23b8-4cb2-ba6c-331c3172c510
   └─ category.user_id = different UUID
   └─ ❌ NO MATCH - RLS blocks read
```

---

## ✅ **THE FIX**

### Option 1: Use Authenticated Supabase User ID (Recommended)
```typescript
// Instead of:
const result = await createCategory(clerkUserId, categoryData);

// Use the actual authenticated Supabase user:
const { data: { user } } = await supabase.auth.getUser();
const result = await createCategory(user.id, categoryData);

// Or get from userIdService if already mapped:
const supabaseUserId = await userIdService.getDatabaseUserId(clerkUserId);
const result = await createCategory(supabaseUserId, categoryData);
```

### Option 2: Map Clerk User to Authenticated Supabase User
Ensure `userIdService` maps the test's `clerkUserId` to the actual authenticated Supabase user (`5847c9c0-23b8-4cb2-ba6c-331c3172c510`).

---

## **WHY THIS HAPPENS**

The app uses **dual authentication**:
1. **Clerk** for frontend auth (produces Clerk user IDs)
2. **Supabase** for backend data (uses Supabase UUIDs)

The `userIdService` maps Clerk IDs → Supabase UUIDs. But in tests:
- We authenticate with Supabase directly (no Clerk)
- We pass a fake `clerkUserId` to functions
- That Clerk ID maps to a **different** Supabase UUID than the authenticated user
- RLS blocks because user_id doesn't match auth.uid()

---

## **VERIFICATION**

After fixing, the test should:
1. ✅ Create category with `user_id = 5847c9c0-23b8-4cb2-ba6c-331c3172c510`
2. ✅ Verify query finds it (RLS allows read when user_id matches auth.uid())
3. ✅ All 10 tests pass

---

## **SUGGESTED FIX LOCATIONS**

### File: `src/services/__tests__/categoryService.real.test.ts`

**Line 109** - Change to:
```typescript
// Get the actual authenticated Supabase user ID
const { data: { user } } = await supabase.auth.getUser();
const result = await createCategory(user.id, categoryData);
```

**Or set up userIdService mapping** in beforeEach:
```typescript
beforeEach(async () => {
  // ... existing auth code ...
  
  // Map the test Clerk ID to the authenticated Supabase user
  const { data: { user } } = await supabase.auth.getUser();
  await userIdService.resolveDatabaseUserId(clerkUserId, user.id);
});
```

---

## **SUMMARY**

✅ RLS policies are **100% correct**
✅ Authentication is **working**
❌ Test is using **wrong user ID** (Clerk ID mapping instead of authenticated Supabase user)

**Fix**: Use `auth.uid()` from the authenticated session instead of mapping through Clerk IDs.

---

_Root cause found: 2025-10-01 00:43 UTC | Status: Fix ready | Next: Update test to use authenticated user ID_
