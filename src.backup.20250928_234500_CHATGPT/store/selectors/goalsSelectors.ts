import type { RootState } from '../../store'
import type { GoalDTO } from '../../types/dto'
import { mapGoalsFromDTO } from '../../types/mappers'

export const selectGoalDTOs = (state: RootState): GoalDTO[] => {
  return (state.goals.goals as unknown) as GoalDTO[]
}

export const selectGoals = (state: RootState) => {
  const dtos = selectGoalDTOs(state)
  return mapGoalsFromDTO(dtos)
}

