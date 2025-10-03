// Test script to verify tax calculations
const { taxDataService } = require('./src/services/taxDataService.ts');

console.log('Testing US Tax Calculations:');
console.log('================================');

// Test case 1: $50,000 single filer
const result1 = taxDataService.calculateTax(50000, 'US', { filingStatus: 'single' });
console.log('$50,000 single filer:');
console.log(`  Calculated: $${result1.federal.toFixed(2)}`);
console.log(`  Expected: $6,617.50`);
console.log(`  Match: ${Math.abs(result1.federal - 6617.50) < 0.01 ? '✓' : '✗'}`);

// Test case 2: $100,000 single filer
const result2 = taxDataService.calculateTax(100000, 'US', { filingStatus: 'single' });
console.log('\n$100,000 single filer:');
console.log(`  Calculated: $${result2.federal.toFixed(2)}`);
console.log(`  Expected: $18,009.50`);
console.log(`  Match: ${Math.abs(result2.federal - 18009.50) < 0.01 ? '✓' : '✗'}`);

// Test case 3: $75,000 married filing jointly
const result3 = taxDataService.calculateTax(75000, 'US', { filingStatus: 'married' });
console.log('\n$75,000 married filing jointly:');
console.log(`  Calculated: $${result3.federal.toFixed(2)}`);
console.log(`  Expected: $8,688.00`);
console.log(`  Match: ${Math.abs(result3.federal - 8688.00) < 0.01 ? '✓' : '✗'}`);

console.log('\n\nTesting UK Tax Calculations:');
console.log('================================');

// Test case 1: £30,000
const result4 = taxDataService.calculateTax(30000, 'UK', { scottish: false });
console.log('£30,000 income:');
console.log(`  Tax Calculated: £${Math.round(result4.incomeTax)}`);
console.log(`  Tax Expected: £3,486`);
console.log(`  Tax Match: ${Math.abs(result4.incomeTax - 3486) <= 1 ? '✓' : '✗'}`);
console.log(`  NI Calculated: £${Math.round(result4.nationalInsurance)}`);
console.log(`  NI Expected: £2,492`);
console.log(`  NI Match: ${Math.abs(result4.nationalInsurance - 2492) <= 1 ? '✓' : '✗'}`);

// Test case 2: £55,000
const result5 = taxDataService.calculateTax(55000, 'UK', { scottish: false });
console.log('\n£55,000 income:');
console.log(`  Tax Calculated: £${Math.round(result5.incomeTax)}`);
console.log(`  Tax Expected: £10,986`);
console.log(`  Tax Match: ${Math.abs(result5.incomeTax - 10986) <= 1 ? '✓' : '✗'}`);
console.log(`  NI Calculated: £${Math.round(result5.nationalInsurance)}`);
console.log(`  NI Expected: £5,252`);
console.log(`  NI Match: ${Math.abs(result5.nationalInsurance - 5252) <= 1 ? '✓' : '✗'}`);