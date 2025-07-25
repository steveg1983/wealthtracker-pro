# XSS Protection Guide

This guide explains how to use the XSS protection features in Wealth Tracker.

## Overview

Wealth Tracker uses DOMPurify to sanitize all user inputs and prevent XSS attacks. The protection is implemented at multiple levels:

1. **Input Sanitization**: All user inputs are sanitized before processing
2. **Validation Layer**: Zod schemas include sanitization transformations
3. **Component Level**: Sanitized input components automatically clean data
4. **Storage Level**: Data is sanitized before storing in localStorage

## Using Sanitized Components

### SanitizedInput Component

Replace regular inputs with `SanitizedInput`:

```tsx
import { SanitizedInput } from '../components/security';

// Basic text input
<SanitizedInput
  value={description}
  onChange={setDescription}
  sanitizeType="text"
  placeholder="Enter description"
/>

// Number input
<SanitizedInput
  value={amount}
  onChange={setAmount}
  sanitizeType="decimal"
  decimals={2}
  placeholder="0.00"
/>

// URL input
<SanitizedInput
  value={website}
  onChange={setWebsite}
  sanitizeType="url"
  placeholder="https://example.com"
/>
```

### SafeHTML Component

For rendering HTML content safely:

```tsx
import { SafeHTML } from '../components/security';

<SafeHTML className="prose">
  {userGeneratedHTML}
</SafeHTML>
```

## Using Sanitization Functions

### Direct Sanitization

```tsx
import { 
  sanitizeText, 
  sanitizeHTML, 
  sanitizeURL,
  sanitizeNumber,
  sanitizeMarkdown 
} from '../security/xss-protection';

// Sanitize text input
const cleanDescription = sanitizeText(userInput);

// Sanitize markdown
const cleanNotes = sanitizeMarkdown(markdownContent);

// Sanitize URL
const cleanUrl = sanitizeURL(urlInput);
```

### Form Sanitization

```tsx
import { useSanitizedForm } from '../hooks/useSanitizedForm';

const MyForm = () => {
  const { values, errors, handleChange, handleSubmit } = useSanitizedForm(
    {
      name: '',
      amount: 0,
      website: '',
      notes: ''
    },
    {
      name: 'text',
      amount: { type: 'decimal', decimals: 2 },
      website: 'url',
      notes: 'html'
    }
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        value={values.name}
        onChange={handleChange('name')}
      />
      {errors.name && <span>{errors.name}</span>}
      {/* ... other fields */}
    </form>
  );
};
```

## Validation Service Integration

The ValidationService automatically sanitizes data:

```tsx
import { ValidationService } from '../services/validationService';

// Transaction validation includes sanitization
const validatedData = ValidationService.validateTransaction({
  description: userInput, // Will be sanitized
  amount: '100.50',
  type: 'expense',
  category: 'food',
  accountId: accountId,
  date: '2024-01-01',
  notes: markdownNotes // Will be sanitized as markdown
});
```

## Best Practices

1. **Always Use Sanitized Components**: Replace `<input>` with `<SanitizedInput>`
2. **Sanitize at Input**: Clean data as early as possible
3. **Use Appropriate Types**: Choose the right sanitization type for each field
4. **Validate and Sanitize**: Use ValidationService for both validation and sanitization
5. **Never Trust User Input**: Always sanitize, even from authenticated users

## Common Patterns

### Transaction Forms

```tsx
// Use ValidationService for transactions
const handleSubmit = (data) => {
  try {
    const validated = ValidationService.validateTransaction(data);
    addTransaction(validated);
  } catch (error) {
    // Handle validation errors
  }
};
```

### Search Inputs

```tsx
import { sanitizeQuery } from '../security/xss-protection';

const handleSearch = (query: string) => {
  const safeQuery = sanitizeQuery(query);
  performSearch(safeQuery);
};
```

### File Uploads

```tsx
import { sanitizeFilename } from '../security/xss-protection';

const handleFileUpload = (file: File) => {
  const safeName = sanitizeFilename(file.name);
  // Process file with sanitized name
};
```

## Testing XSS Protection

1. Try injecting script tags: `<script>alert('XSS')</script>`
2. Test HTML entities: `&lt;img src=x onerror=alert('XSS')&gt;`
3. Check URL injections: `javascript:alert('XSS')`
4. Verify markdown sanitization: `[link](javascript:alert('XSS'))`

All these should be safely neutralized by the sanitization system.

## Troubleshooting

- **Content disappearing**: Check if you're using the right sanitization type
- **Validation errors**: Ensure sanitization happens before validation
- **Performance issues**: Use `sanitizeOnBlur` for better UX with large inputs