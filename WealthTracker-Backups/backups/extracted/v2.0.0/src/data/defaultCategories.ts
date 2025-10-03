interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
}

export function getMinimalSystemCategories(): Category[] {
  return [
    // Only the essential system categories
    { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
    
    // Transfer detail categories (required for transfers to work)
    { id: 'transfer-in', name: 'Transfer In', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },
    { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },
  ];
}

export function getDefaultCategories(): Category[] {
  return [
    // Type level categories
    { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
    
    // Income sub-categories
    { id: 'sub-salary', name: 'Salary & Wages', type: 'income', level: 'sub', parentId: 'type-income', isSystem: true },
    { id: 'sub-business', name: 'Business Income', type: 'income', level: 'sub', parentId: 'type-income', isSystem: true },
    { id: 'sub-investment-income', name: 'Investment Income', type: 'income', level: 'sub', parentId: 'type-income', isSystem: true },
    { id: 'sub-other-income', name: 'Other Income', type: 'income', level: 'sub', parentId: 'type-income', isSystem: true },
    
    // Income detail categories
    { id: 'salary', name: 'Regular Salary', type: 'income', level: 'detail', parentId: 'sub-salary' },
    { id: 'bonus', name: 'Bonus', type: 'income', level: 'detail', parentId: 'sub-salary' },
    { id: 'overtime', name: 'Overtime', type: 'income', level: 'detail', parentId: 'sub-salary' },
    { id: 'freelance', name: 'Freelance Income', type: 'income', level: 'detail', parentId: 'sub-business' },
    { id: 'dividends', name: 'Dividends', type: 'income', level: 'detail', parentId: 'sub-investment-income' },
    { id: 'interest', name: 'Interest', type: 'income', level: 'detail', parentId: 'sub-investment-income' },
    { id: 'capital-gains', name: 'Capital Gains', type: 'income', level: 'detail', parentId: 'sub-investment-income' },
    { id: 'rental-income', name: 'Rental Income', type: 'income', level: 'detail', parentId: 'sub-other-income' },
    { id: 'gifts-received', name: 'Gifts Received', type: 'income', level: 'detail', parentId: 'sub-other-income' },
    
    // Expense sub-categories
    { id: 'sub-housing', name: 'Housing', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-transport', name: 'Transport', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-food', name: 'Food & Dining', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-utilities', name: 'Utilities', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-healthcare', name: 'Healthcare', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-entertainment', name: 'Entertainment', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-shopping', name: 'Shopping', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-education', name: 'Education', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-personal', name: 'Personal Care', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-insurance', name: 'Insurance', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-savings', name: 'Savings & Investments', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-taxes', name: 'Taxes', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-other-expense', name: 'Other Expenses', type: 'expense', level: 'sub', parentId: 'type-expense', isSystem: true },
    { id: 'sub-adjustments', name: 'Adjustments', type: 'both', level: 'sub', parentId: 'type-expense', isSystem: true },
    
    // Housing detail categories
    { id: 'rent', name: 'Rent', type: 'expense', level: 'detail', parentId: 'sub-housing' },
    { id: 'mortgage', name: 'Mortgage', type: 'expense', level: 'detail', parentId: 'sub-housing' },
    { id: 'property-tax', name: 'Property Tax', type: 'expense', level: 'detail', parentId: 'sub-housing' },
    { id: 'home-maintenance', name: 'Home Maintenance', type: 'expense', level: 'detail', parentId: 'sub-housing' },
    { id: 'home-insurance', name: 'Home Insurance', type: 'expense', level: 'detail', parentId: 'sub-insurance' },
    
    // Transport detail categories
    { id: 'fuel', name: 'Fuel', type: 'expense', level: 'detail', parentId: 'sub-transport' },
    { id: 'public-transport', name: 'Public Transport', type: 'expense', level: 'detail', parentId: 'sub-transport' },
    { id: 'car-maintenance', name: 'Car Maintenance', type: 'expense', level: 'detail', parentId: 'sub-transport' },
    { id: 'car-insurance', name: 'Car Insurance', type: 'expense', level: 'detail', parentId: 'sub-insurance' },
    { id: 'parking', name: 'Parking', type: 'expense', level: 'detail', parentId: 'sub-transport' },
    { id: 'tolls', name: 'Tolls', type: 'expense', level: 'detail', parentId: 'sub-transport' },
    
    // Food detail categories
    { id: 'groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
    { id: 'restaurants', name: 'Restaurants', type: 'expense', level: 'detail', parentId: 'sub-food' },
    { id: 'takeout', name: 'Takeout/Delivery', type: 'expense', level: 'detail', parentId: 'sub-food' },
    { id: 'coffee-shops', name: 'Coffee Shops', type: 'expense', level: 'detail', parentId: 'sub-food' },
    
    // Utilities detail categories
    { id: 'electricity', name: 'Electricity', type: 'expense', level: 'detail', parentId: 'sub-utilities' },
    { id: 'water', name: 'Water', type: 'expense', level: 'detail', parentId: 'sub-utilities' },
    { id: 'gas', name: 'Gas', type: 'expense', level: 'detail', parentId: 'sub-utilities' },
    { id: 'internet', name: 'Internet', type: 'expense', level: 'detail', parentId: 'sub-utilities' },
    { id: 'phone', name: 'Phone', type: 'expense', level: 'detail', parentId: 'sub-utilities' },
    { id: 'tv', name: 'TV/Streaming', type: 'expense', level: 'detail', parentId: 'sub-utilities' },
    
    // Healthcare detail categories
    { id: 'health-insurance', name: 'Health Insurance', type: 'expense', level: 'detail', parentId: 'sub-insurance' },
    { id: 'doctor', name: 'Doctor Visits', type: 'expense', level: 'detail', parentId: 'sub-healthcare' },
    { id: 'dentist', name: 'Dental Care', type: 'expense', level: 'detail', parentId: 'sub-healthcare' },
    { id: 'pharmacy', name: 'Pharmacy', type: 'expense', level: 'detail', parentId: 'sub-healthcare' },
    { id: 'vision', name: 'Vision Care', type: 'expense', level: 'detail', parentId: 'sub-healthcare' },
    
    // Entertainment detail categories
    { id: 'movies', name: 'Movies & Shows', type: 'expense', level: 'detail', parentId: 'sub-entertainment' },
    { id: 'concerts', name: 'Concerts & Events', type: 'expense', level: 'detail', parentId: 'sub-entertainment' },
    { id: 'sports', name: 'Sports & Recreation', type: 'expense', level: 'detail', parentId: 'sub-entertainment' },
    { id: 'hobbies', name: 'Hobbies', type: 'expense', level: 'detail', parentId: 'sub-entertainment' },
    { id: 'subscriptions', name: 'Subscriptions', type: 'expense', level: 'detail', parentId: 'sub-entertainment' },
    
    // Shopping detail categories
    { id: 'clothing', name: 'Clothing', type: 'expense', level: 'detail', parentId: 'sub-shopping' },
    { id: 'electronics', name: 'Electronics', type: 'expense', level: 'detail', parentId: 'sub-shopping' },
    { id: 'household', name: 'Household Items', type: 'expense', level: 'detail', parentId: 'sub-shopping' },
    { id: 'gifts', name: 'Gifts', type: 'expense', level: 'detail', parentId: 'sub-shopping' },
    
    // Adjustment categories
    { id: 'account-adjustments', name: 'Account Adjustments', type: 'both', level: 'detail', parentId: 'sub-adjustments', isSystem: true },
    
    // Transfer categories
    { id: 'transfer-in', name: 'Transfer In', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },
    { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer', isSystem: true },
  ];
}