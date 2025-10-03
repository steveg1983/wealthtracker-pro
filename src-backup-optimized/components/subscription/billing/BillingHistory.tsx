import { memo, useEffect } from 'react';
import { DownloadIcon } from '../../icons';
import { BillingDashboardService } from '../../../services/billingDashboardService';
import type { Invoice } from '../../../types/subscription';
import { useLogger } from '../services/ServiceProvider';

interface BillingHistoryProps {
  invoices: Invoice[];
}

export const BillingHistory = memo(function BillingHistory({ invoices
 }: BillingHistoryProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('BillingHistory component initialized', {
      componentName: 'BillingHistory'
    });
  }, []);

  if (invoices.length === 0) return <></>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Billing History
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                Date
              </th>
              <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                Description
              </th>
              <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                Amount
              </th>
              <th className="text-left py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                Status
              </th>
              <th className="text-right py-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                Download
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

const InvoiceRow = memo(function InvoiceRow({ 
  invoice 
}: { 
  invoice: Invoice 
}) {
  const logger = useLogger();
  return (
    <tr>
      <td className="py-4 text-sm text-gray-900 dark:text-white">
        {BillingDashboardService.formatDate(invoice.createdAt)}
      </td>
      <td className="py-4 text-sm text-gray-900 dark:text-white">
        {invoice.description || 'Subscription payment'}
      </td>
      <td className="py-4 text-sm text-gray-900 dark:text-white">
        {BillingDashboardService.formatPrice(invoice.amount)}
      </td>
      <td className="py-4">
        <span className={`text-xs px-2 py-1 rounded-full ${
          BillingDashboardService.getInvoiceStatusColor(invoice.status)
        }`}>
          {invoice.status}
        </span>
      </td>
      <td className="py-4 text-right">
        {invoice.invoicePdf && (
          <a
            href={invoice.invoicePdf}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-gray-500 hover:text-blue-700 dark:hover:text-gray-300"
          >
            <DownloadIcon size={16} />
          </a>
        )}
      </td>
    </tr>
  );
});