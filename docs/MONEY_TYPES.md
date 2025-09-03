# Money Types (Accuracy First)

Financial amounts must never use floating‑point arithmetic. To enforce correctness:

- Use Decimal.js or string amounts at runtime.
- Prefer a branded Money type to avoid accidental mixing with numbers.

## Type

```ts
// src/types/money.ts
export type Money = string & { readonly __brand: 'Money' };
```

## Helpers

- `toMoney(n)`: normalizes to 2 decimals
- `addMoney(a, b)`: integer‑cents addition
- `compareMoney(a, b)`, `absMoney(a)`

## Migration Strategy

1) New code paths should accept/return `Money` instead of `number`.
2) Module boundaries (services, DTOs) should convert input numbers to `Money` using `toMoney()`.
3) Use Decimal.js for analytics/calculations, but keep amounts as strings at the domain edges.
4) Add lint checks/code reviews to reject new `number` amounts.

## Display

Use existing formatting helpers: `useCurrencyDecimal().formatCurrency()` and currency utilities. Avoid constructing display strings from raw numbers.

## Testing

- Unit test calculation/formatting using representative data.
- Never compare floats; compare `Money` or Decimal values.

