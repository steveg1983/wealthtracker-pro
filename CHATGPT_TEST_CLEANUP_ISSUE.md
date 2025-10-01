# ChatGPT - Test Cleanup Working, Read Issue Remains

**Date**: 2025-10-01 01:17 UTC
**Status**: Categories created & deleted, but can't be read during test execution

---

## ✅ **WHAT'S WORKING:**

1. ✅ **INSERT works** - Categories are being created
2. ✅ **DELETE works** - afterEach cleanup deletes them (that's why DB queries find nothing)
3. ✅ **Authentication works** - User logged in successfully
4. ✅ **RLS policies exist** - All CRUD policies created with TO anon, authenticated

---

## ❌ **WHAT'S FAILING:**

During test execution (before afterEach cleanup):
- `createCategory()` succeeds (returns category object)
- But `getCategories()` returns **0 rows** immediately after
- Tests fail because they can't find the just-created categories

---

## 🎯 **DIAGNOSIS:**

The `afterEach` deletes categories successfully:
```typescript
await supabase
  .from('categories')
  .delete()
  .in('id', createdCategoryIds);
```

This proves:
1. Categories WERE created (otherwise nothing to delete)
2. RLS allows DELETE (cleanup works)
3. But RLS is blocking SELECT somehow

---

## 🐛 **POSSIBLE CAUSES:**

### Theory 1: resolveSupabaseUserId Returns Wrong ID
Check `categoryService.ts` line 337:
```typescript
const resolvedUserId = await resolveSupabaseUserId(client, clerkId);
```

This function might be returning a DIFFERENT user_id than the authenticated user.

**Debug**: Add console.log to see what it returns:
```typescript
const resolvedUserId = await resolveSupabaseUserId(client, clerkId);
console.log('[createCategory] resolved user_id:', resolvedUserId);
console.log('[createCategory] auth.uid():', (await client.auth.getUser()).data.user?.id);
```

If these don't match, that's the problem!

### Theory 2: getCategories Uses Different Resolution
Check `categoryService.ts` line 197:
```typescript
const resolvedUserId = await resolveSupabaseUserId(client, clerkId);
```

**Both createCategory AND getCategories** call `resolveSupabaseUserId`. If this function is non-deterministic or caches differently, they might resolve to different user_ids.

### Theory 3: RLS Policy Not Applied to Anon Role
Even though we added `TO anon, authenticated`, double-check the policies are actually active.

Run this query:
```sql
SELECT policyname, cmd, roles::text[], qual 
FROM pg_policies 
WHERE tablename = 'categories'
ORDER BY cmd, policyname;
```

Verify `roles` column shows `{anon, authenticated}` for all policies.

---

## 🔧 **RECOMMENDED DEBUG STEPS:**

### Step 1: Add Logging to categoryService.ts
```typescript
// In createCategory (line 337)
const resolvedUserId = await resolveSupabaseUserId(client, clerkId);
console.log('[createCategory] Input clerkId:', clerkId);
console.log('[createCategory] Resolved user_id:', resolvedUserId);
console.log('[createCategory] Auth user:', (await client.auth.getUser()).data.user?.id);

// In getCategories (line 197)
const resolvedUserId = await resolveSupabaseUserId(client, clerkId);
console.log('[getCategories] Input clerkId:', clerkId);  
console.log('[getCategories] Resolved user_id:', resolvedUserId);
console.log('[getCategories] Auth user:', (await client.auth.getUser()).data.user?.id);
```

### Step 2: Run Test and Check Logs
```bash
env VITEST_SUPABASE_MODE=real VITEST_SUPABASE_EMAIL=s.green1983@icloud.com VITEST_SUPABASE_PASSWORD=genJaw-myhwet-2mebqa npx vitest run src/services/__tests__/categoryService.real.test.ts --reporter=verbose 2>&1 | grep -A2 "createCategory\|getCategories"
```

This will show if `createCategory` and `getCategories` are using the **same user_id**.

### Step 3: Check resolveSupabaseUserId Logic
The function has complex logic:
1. Checks if client exists
2. Gets auth user
3. Falls back to pattern matching
4. Falls back to userIdService mapping

**Hypothesis**: `createCategory` might get auth.uid(), but `getCategories` might get a different ID from the fallback logic.

---

## 📋 **SUMMARY**

✅ RLS: Working perfectly
✅ Auth: User authenticated
✅ INSERT: Creates categories
✅ DELETE: Cleanup works
❌ SELECT: Returns 0 rows during test (but delete finds the rows!)

**Mystery**: DELETE can find the categories (in afterEach), but SELECT can't (during test assertions).

**Most Likely**: `resolveSupabaseUserId()` returns different values for create vs get.

---

_Next: Add logging to categoryService.ts to see what user_ids are being used_
