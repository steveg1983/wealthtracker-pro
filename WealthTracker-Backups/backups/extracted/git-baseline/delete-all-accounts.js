import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deleteAllAccounts() {
  try {
    console.log('🔍 Fetching all accounts...');
    
    // Get all accounts
    const { data: accounts, error: fetchError } = await supabase
      .from('accounts')
      .select('id, name, type, balance, user_id');
    
    if (fetchError) {
      console.error('Error fetching accounts:', fetchError);
      return;
    }
    
    console.log(`Found ${accounts?.length || 0} accounts to delete:`);
    accounts?.forEach(acc => {
      console.log(`  - ${acc.name} (${acc.type}): $${acc.balance}`);
    });
    
    if (!accounts || accounts.length === 0) {
      console.log('No accounts to delete.');
      return;
    }
    
    const accountIds = accounts.map(a => a.id);
    
    console.log('\n🗑️  Starting deletion process...\n');
    
    // Step 1: Delete all transactions
    console.log('1. Deleting transactions...');
    const { error: transError, count: transCount } = await supabase
      .from('transactions')
      .delete()
      .in('account_id', accountIds);
    
    if (transError) {
      console.error('Error deleting transactions:', transError);
    } else {
      console.log(`   ✓ Deleted ${transCount || 0} transactions`);
    }
    
    // Step 2: Delete transfer categories
    console.log('2. Deleting transfer categories...');
    const { error: catError, count: catCount } = await supabase
      .from('categories')
      .delete()
      .in('account_id', accountIds);
    
    if (catError) {
      console.error('Error deleting categories:', catError);
    } else {
      console.log(`   ✓ Deleted ${catCount || 0} transfer categories`);
    }
    
    // Step 3: Delete holdings (if any)
    console.log('3. Deleting investment holdings...');
    const { error: holdError, count: holdCount } = await supabase
      .from('holdings')
      .delete()
      .in('account_id', accountIds);
    
    if (holdError && holdError.code !== '42P01') { // Ignore table doesn't exist
      console.error('Error deleting holdings:', holdError);
    } else {
      console.log(`   ✓ Deleted ${holdCount || 0} holdings`);
    }
    
    // Step 4: Delete recurring transactions
    console.log('4. Deleting recurring transactions...');
    const { error: recurError, count: recurCount } = await supabase
      .from('recurring_transactions')
      .delete()
      .in('account_id', accountIds);
    
    if (recurError && recurError.code !== '42P01') { // Ignore table doesn't exist
      console.error('Error deleting recurring transactions:', recurError);
    } else {
      console.log(`   ✓ Deleted ${recurCount || 0} recurring transactions`);
    }
    
    // Step 5: Update goals to remove account links
    console.log('5. Updating goals to remove account links...');
    const { error: goalError } = await supabase
      .from('goals')
      .update({ linked_account_ids: [] })
      .not('linked_account_ids', 'is', null);
    
    if (goalError && goalError.code !== '42P01') {
      console.error('Error updating goals:', goalError);
    } else {
      console.log('   ✓ Updated goals');
    }
    
    // Step 6: Finally delete all accounts
    console.log('6. Deleting accounts...');
    const { error: accError, count: accCount } = await supabase
      .from('accounts')
      .delete()
      .in('id', accountIds);
    
    if (accError) {
      console.error('Error deleting accounts:', accError);
      return;
    }
    
    console.log(`   ✓ Deleted ${accCount || accounts.length} accounts`);
    
    // Verify deletion
    console.log('\n✅ Verification:');
    const { data: remainingAccounts } = await supabase
      .from('accounts')
      .select('id');
    
    console.log(`   Remaining accounts: ${remainingAccounts?.length || 0}`);
    
    console.log('\n🎉 Account deletion complete!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the deletion
deleteAllAccounts();