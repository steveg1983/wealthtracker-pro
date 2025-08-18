# SQL Query Cleanup Guide - Supabase Editor

## Queries to KEEP (Still Useful)

### 1. ✅ **WealthTracker Database Schema**
- **Keep**: Useful for viewing overall database structure
- **Purpose**: Quick reference for table schemas

### 2. ✅ **Database Schema Inspection**  
- **Keep**: Useful for checking column types and constraints
- **Purpose**: General database maintenance and debugging

### 3. ✅ **Stripe Subscription Integration Schema**
- **Keep**: If you're implementing Stripe subscriptions
- **Purpose**: Reference for subscription system

## Queries to DELETE (No Longer Needed)

### 1. ❌ **UUID to Text Migration for Auth System**
- **Delete**: Migration is complete
- **Reason**: Already successfully executed

### 2. ❌ **User Profile and Account ID Mismatch Analysis**
- **Delete**: Was for debugging the migration
- **Reason**: Issue is resolved

### 3. ❌ **User Profile Analysis and Audit**
- **Delete**: Was for investigating the "1060 profiles" confusion
- **Reason**: Confirmed only 1 profile exists

### 4. ❌ **User Profile Duplication Investigation**
- **Delete**: Investigation complete
- **Reason**: No duplicates found, was a misunderstanding

### 5. ❌ **Duplicate User Profile Analysis**
- **Delete**: Same as above
- **Reason**: Investigation complete

### 6. ❌ **User Profile Duplication Audit and Cleanup**
- **Delete**: No cleanup was needed
- **Reason**: Only 1 profile exists

### 7. ❌ **Duplicate Profile Cleanup and Constraint Addition**
- **Delete**: Constraints already added
- **Reason**: Task complete

### 8. ❌ **Add Unique Constraints to User Profiles**
- **Delete**: Constraints already added
- **Reason**: Task complete (you have unique_clerk_user_id and unique_email constraints)

## Summary

**Keep**: 3 queries (general reference queries)
**Delete**: 8 queries (migration and debugging queries that are no longer needed)

The migration is complete, constraints are in place, and the system is working correctly. You only need to keep the reference queries for future database work.