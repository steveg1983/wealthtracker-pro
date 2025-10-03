import type { RootState } from '../../store'
import type { BudgetDTO } from '../../types/dto'
import { mapBudgetsFromDTO } from '../../types/mappers'

export const selectBudgetDTOs = (state: RootState): BudgetDTO[] => {
  return state.budgets.budgets as unknown as BudgetDTO[]
}

export const selectBudgets = (state: RootState) => {
  const dtos = selectBudgetDTOs(state)
  return mapBudgetsFromDTO(dtos)
}
