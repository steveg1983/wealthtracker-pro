import type { RootState } from '../../store'
import type { TransactionDTO } from '../../types/dto'
import { mapTransactionsFromDTO } from '../../types/mappers'

// Select raw DTOs from Redux
export const selectTransactionDTOs = (state: RootState): TransactionDTO[] => {
  return (state.transactions.transactions as unknown) as TransactionDTO[]
}

// Select domain Transactions
export const selectTransactions = (state: RootState) => {
  const dtos = selectTransactionDTOs(state)
  return mapTransactionsFromDTO(dtos)
}

