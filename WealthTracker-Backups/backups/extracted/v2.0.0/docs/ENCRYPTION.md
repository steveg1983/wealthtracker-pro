# Encryption Guide

This guide explains the encryption features in Wealth Tracker and how to use them.

## Overview

Wealth Tracker implements multiple layers of encryption to protect sensitive financial data:

1. **Storage Encryption**: All sensitive data in IndexedDB is encrypted
2. **Field-Level Encryption**: Individual form fields can be encrypted
3. **Key Management**: Secure key derivation and rotation
4. **Transport Security**: HTTPS enforced via CSP

## Architecture

### Encryption Services

1. **EncryptedStorageService** (`src/services/encryptedStorageService.ts`)
   - Handles bulk data encryption in IndexedDB
   - Automatic migration from localStorage
   - Compression for large data sets
   - Expiry management for cached data

2. **EnhancedEncryptionService** (`src/security/encryption-enhanced.ts`)
   - Advanced key management with PBKDF2
   - Device fingerprinting for key generation
   - Key rotation capabilities
   - HMAC for data integrity

### Storage Adapter

The `storageAdapter` (`src/services/storageAdapter.ts`) automatically encrypts:
- Account information
- Transaction data
- Budget details
- Financial goals

## Usage

### Using Encrypted Storage

```typescript
import { storageAdapter } from '../services/storageAdapter';

// Store encrypted data
await storageAdapter.set('sensitive_data', {
  accountNumber: '1234567890',
  balance: 10000
});

// Retrieve and decrypt
const data = await storageAdapter.get('sensitive_data');
```

### Using SecureField Component

For sensitive form inputs:

```tsx
import { SecureField } from '../components/security/SecureField';

<SecureField
  label="Account Number"
  value={accountNumber}
  onChange={setAccountNumber}
  isEncrypted={true}
  type="password"
  helperText="Your data is encrypted"
/>
```

### Using Encrypted State Hook

For managing encrypted state in components:

```tsx
import { useEncryptedState } from '../hooks/useEncryptedState';

function MyComponent() {
  const [sensitiveData, setSensitiveData, isLoading, error] = useEncryptedState(
    { accountNumber: '', pin: '' },
    { 
      storageKey: 'my_sensitive_data',
      persist: true 
    }
  );

  // State is automatically encrypted/decrypted
  return (
    <input
      value={sensitiveData.accountNumber}
      onChange={(e) => setSensitiveData({
        ...sensitiveData,
        accountNumber: e.target.value
      })}
    />
  );
}
```

### Using Encrypted Forms

For entire forms with encryption:

```tsx
import { useEncryptedForm } from '../hooks/useEncryptedState';

function SecureForm() {
  const { values, setFieldValue, getEncryptedValues } = useEncryptedForm({
    cardNumber: '',
    cvv: '',
    pin: ''
  });

  const handleSubmit = () => {
    const encrypted = getEncryptedValues();
    // Send encrypted data to server
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={values.cardNumber}
        onChange={(e) => setFieldValue('cardNumber', e.target.value)}
      />
    </form>
  );
}
```

## Security Features

### Key Derivation

- Uses PBKDF2 with SHA-256
- 10,000 iterations (configurable)
- Random salt for each encryption
- Device fingerprint as additional entropy

### Encryption Algorithm

- AES-256-CBC encryption
- Random IV for each encryption
- PKCS7 padding
- Base64 encoding for storage

### Key Storage

- Master key encrypted with device-specific key
- Stored in IndexedDB (not localStorage)
- Session-based with optional persistence
- Automatic key rotation every 30 days

### Data Integrity

- HMAC-SHA256 for integrity verification
- Timestamp validation
- Secure comparison to prevent timing attacks

## Best Practices

1. **Use Appropriate Storage**
   ```typescript
   // Sensitive financial data - use encrypted storage
   await storageAdapter.set(STORAGE_KEYS.ACCOUNTS, accountData);
   
   // Non-sensitive preferences - regular storage is fine
   localStorage.setItem('theme', 'dark');
   ```

2. **Handle Errors Gracefully**
   ```typescript
   try {
     const data = await storageAdapter.get('sensitive_data');
   } catch (error) {
     console.error('Decryption failed:', error);
     // Handle gracefully - don't expose error details to user
   }
   ```

3. **Clear Sensitive Data**
   ```typescript
   // Clear encryption keys on logout
   enhancedEncryption.clearSensitiveData();
   
   // Clear all encrypted storage
   await storageAdapter.clear();
   ```

4. **Use Field-Level Encryption Sparingly**
   - Only for highly sensitive fields (SSN, account numbers)
   - Consider UX impact of encryption/decryption time
   - Provide visual feedback (lock icon, "Encrypted" label)

## Migration

When the app starts, it automatically:

1. Checks for data in localStorage
2. Migrates to encrypted IndexedDB storage
3. Removes data from localStorage
4. Sets migration flag to prevent re-migration

## Performance Considerations

- Encryption/decryption adds ~10-50ms overhead
- Bulk operations are optimized
- Large data (>10KB) is automatically compressed
- IndexedDB provides better performance than localStorage

## Troubleshooting

### "Failed to initialize encryption"
- Check if IndexedDB is available
- Ensure cookies/storage are not blocked
- Try clearing browser data

### "Failed to decrypt data"
- Key may have changed (device fingerprint)
- Data may be corrupted
- Try logging out and back in

### Performance Issues
- Enable compression for large data sets
- Use bulk operations when possible
- Consider caching decrypted data in memory

## Security Considerations

- Keys are derived from device fingerprint
- No keys are sent to servers
- All encryption happens client-side
- Regular key rotation is enforced
- Use HTTPS in production (enforced by CSP)