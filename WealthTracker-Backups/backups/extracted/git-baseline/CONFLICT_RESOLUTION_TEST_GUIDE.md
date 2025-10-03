# Enhanced Conflict Resolution Testing Guide

## Overview
We've implemented a "top tier" intelligent conflict resolution system with field-level merging, smart auto-resolution, and business rule-based decisions.

## What's New

### 1. **Field-Level Merging**
- Instead of choosing entire record (all-or-nothing), the system can merge individual fields
- Example: If you change amount in one browser and category in another, both changes are preserved

### 2. **Smart Auto-Resolution** 
- System analyzes conflicts and auto-resolves when confidence is high (>70%)
- Non-conflicting changes are automatically merged
- Shows green notification when conflicts are auto-resolved

### 3. **Business Rules**
- **Account Balances**: Server always wins (source of truth)
- **Transaction Cleared Status**: Once cleared, stays cleared (MAX strategy)
- **Budget Amounts**: Takes lower value (conservative approach)
- **Tags**: Union merge (combines tags from both versions)
- **Notes**: Concatenates with timestamps

### 4. **Enhanced UI**
- Smart Merge option with purple highlighting
- Field-by-field comparison showing which fields conflict
- Confidence percentage displayed
- Visual indicators for compatible vs conflicting changes

## Testing Scenarios

### Scenario 1: Field-Level Auto-Merge (No User Intervention)
1. Open app in two browsers (Chrome and Safari)
2. In Chrome: Edit a transaction's **amount**
3. In Safari: Edit the same transaction's **category**
4. **Expected**: Both changes merge automatically, green notification appears

### Scenario 2: Smart Conflict Resolution (High Confidence)
1. Open app in two browsers
2. Go offline in Chrome (DevTools > Network > Offline)
3. Edit a transaction's description to "Groceries"
4. Go back online
5. In Safari: Edit same transaction's description to "Food Shopping"
6. **Expected**: Conflict detected but auto-resolved based on timestamp

### Scenario 3: Manual Resolution Required (Critical Fields)
1. Open app in two browsers
2. In Chrome: Change account balance to £1000
3. In Safari: Change same account balance to £2000
4. **Expected**: Manual resolution modal appears with field comparison

### Scenario 4: Business Rule Resolution
1. Open app in two browsers
2. In Chrome: Mark a transaction as cleared
3. In Safari: Try to unmark the same transaction
4. **Expected**: Transaction stays cleared (business rule: once cleared, always cleared)

### Scenario 5: Tag/Note Merging
1. Open app in two browsers
2. In Chrome: Add tags ["personal", "food"] to a transaction
3. In Safari: Add tags ["business", "lunch"] to same transaction
4. **Expected**: Transaction has all tags ["personal", "food", "business", "lunch"]

## How to Test

### Using DevTools to Simulate Offline
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Toggle "Offline" checkbox
4. Make changes while offline
5. Go back online to trigger sync

### Monitoring Conflicts
- Watch the console for messages like:
  - `Auto-resolving conflict for transaction with 85% confidence`
  - `Conflict detected: transaction`
- Look for visual indicators:
  - Green notification: Auto-resolved
  - Amber notification: Needs attention
  - Modal popup: Manual resolution required

### Understanding the Modal
When manual resolution is needed:
1. **Smart Merge** (purple) - AI-suggested combination
2. **Your Version** (blue) - Keep your local changes
3. **Server Version** (green) - Keep server changes

Each field shows:
- Current values from both versions
- Conflict/Compatible badges
- Smart merge result preview

## Configuration

The system uses these thresholds:
- **Auto-resolve threshold**: 70% confidence
- **Critical fields**: amount, balance, targetAmount (require 90% confidence)
- **Retry attempts**: 3 times with exponential backoff
- **Sync interval**: Every 5 seconds when online

## Debug Commands

In browser console:
```javascript
// Check sync status
syncService.getStatus()

// View pending conflicts
syncService.getConflicts()

// Force sync
syncService.forceSync()

// Clear sync queue (use carefully!)
syncService.clearQueue()
```

## Expected Behavior Summary

| Scenario | Auto-Resolve? | User Sees |
|----------|--------------|-----------|
| Different fields changed | ✅ Yes | Green notification |
| Same field, different values | ⚠️ Maybe | Depends on confidence |
| Critical field conflict | ❌ No | Modal for review |
| Offline edits syncing | ✅ Usually | Green notification |
| True conflict (incompatible) | ❌ No | Modal with options |

## Tips for Testing

1. **Use Incognito/Private windows** to simulate different users
2. **Check IndexedDB** in DevTools > Application to see offline queue
3. **Watch Network tab** for WebSocket messages
4. **Enable verbose logging** in console for detailed sync info
5. **Test with realistic delays** between edits (not instant)

## Success Metrics

Your conflict resolution is working well if:
- ✅ Most conflicts resolve automatically (>80%)
- ✅ Users rarely see conflict modals
- ✅ No data loss occurs
- ✅ Changes sync within 5 seconds when online
- ✅ Offline changes queue and sync properly
- ✅ The app "just works" like iCloud/Google Drive

---

**Remember**: The goal is for users to never think about sync - it should "just work"!