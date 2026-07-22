import type { UsePeriodResult } from '../../hooks/usePeriod';

/**
 * What the hub hands every report: the shared reporting period.
 *
 * Kept in its own module so a report view never has to import the registry
 * that lazy-loads it (which would put a cycle in the chunk graph).
 */
export interface ReportViewProps {
  picker: UsePeriodResult;
}
