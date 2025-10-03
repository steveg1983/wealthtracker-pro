import type { RootState } from '../../store'
import type { AccountDTO } from '../../types/dto'
import { mapAccountsFromDTO } from '../../types/mappers'

// Select raw DTOs from Redux (JSON-friendly)
export const selectAccountDTOs = (state: RootState): AccountDTO[] => {
  // State is typed as Account[], but we store JSON-friendly payloads.
  // Cast to DTO for mapping (fields are compatible).
  return (state.accounts.accounts as unknown) as AccountDTO[]
}

// Select domain Accounts (Dates parsed)
export const selectAccounts = (state: RootState) => {
  const dtos = selectAccountDTOs(state)
  return mapAccountsFromDTO(dtos)
}

