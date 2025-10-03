export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return formatNumber(num);
}
