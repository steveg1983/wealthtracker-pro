import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictResolutionService } from '../conflictResolutionService';
import { analyticsEngine } from '../analyticsEngine';

describe('ConflictResolutionService telemetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(analyticsEngine, 'track').mockImplementation(() => undefined);
  });

  it('tracks auto-resolved conflicts with context metadata', () => {
    const now = Date.now();
    const clientData = {
      id: 'goal-1',
      currentAmount: 550,
      targetAmount: 1000,
    };
    const serverData = {
      id: 'goal-1',
      currentAmount: 500,
      targetAmount: 1000,
    };

    ConflictResolutionService.analyzeConflict('goal', clientData, serverData, now + 5000, now);

    expect(analyticsEngine.track).toHaveBeenCalledWith(
      'conflict_auto_resolved',
      expect.objectContaining({
        entity: 'goal',
        conflictId: 'goal-1',
        fields: ['currentAmount'],
      }),
    );
  });
});
