export function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

export function formatDateRange(
  value: { start: Date | null; end: Date | null; label?: string },
  placeholder: string = 'Select date range'
): string {
  if (value.label) return value.label;
  if (!value.start && !value.end) return placeholder;
  if (value.start && value.end) {
    if (value.start.toDateString() === value.end.toDateString()) {
      return formatDate(value.start);
    }
    return `${formatDate(value.start)} - ${formatDate(value.end)}`;
  }
  if (value.start) return `From ${formatDate(value.start)}`;
  if (value.end) return `Until ${formatDate(value.end)}`;
  return placeholder;
}