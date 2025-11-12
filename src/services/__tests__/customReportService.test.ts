import { describe, it, expect, vi } from 'vitest';
import { CustomReportService } from '../customReportService';
import type { CustomReport } from '../../components/CustomReportBuilder';

const createStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    dump: () => data
  };
};

const sampleReport: CustomReport = {
  id: 'report-1',
  name: 'Weekly Overview',
  description: '',
  components: [],
  filters: {
    dateRange: 'month',
    customEndDate: undefined,
    customStartDate: undefined,
    accounts: [],
    categories: [],
    tags: []
  }
};

describe('CustomReportService (deterministic)', () => {
  it('persists reports through injected storage', () => {
    const storage = createStorage();
    const service = new CustomReportService({ storage });

    service.saveCustomReport(sampleReport);
    expect(storage.setItem).toHaveBeenCalledWith(
      'money_management_custom_reports',
      JSON.stringify([sampleReport])
    );

    service.deleteCustomReport(sampleReport.id);
    expect(JSON.parse(storage.getItem.mock.calls.at(-1)?.[1] ?? '[]')).toHaveLength(0);
  });

  it('uses injected storage to load reports safely', () => {
    const storage = createStorage();
    storage.setItem('money_management_custom_reports', JSON.stringify([sampleReport]));
    const service = new CustomReportService({ storage });

    const reports = service.getCustomReports();
    expect(reports).toHaveLength(1);
    expect(storage.getItem).toHaveBeenCalledWith('money_management_custom_reports');
  });
});
