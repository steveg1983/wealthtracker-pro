import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import PageWrapper from '../components/PageWrapper';
import { bankConnectionService } from '../services/bankConnectionService';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('BankingCallback');

type Status = 'idle' | 'working' | 'success' | 'error';

export default function BankingCallback() {
  const navigate = useNavigate();
  const { getToken, isLoaded } = useClerkAuth();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('Preparing to connect your bank...');

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  const notifyOpener = useCallback((payload: { status: 'success' | 'error'; error?: string; connectionId?: string }) => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: 'wealthtracker:bank-oauth-complete',
          ...payload
        },
        window.location.origin
      );
    }
  }, []);

  // When we run as an OAuth popup, close ourselves once the opener has been
  // notified — on error/cancel as well as success. Leaving the popup open left
  // a second app window running, which (on Safari) could trigger a cross-tab
  // reload loop. No-op for the full-page redirect flow (no window.opener), where
  // the in-page buttons below are the correct exit.
  const closeIfPopup = useCallback((delayMs: number) => {
    if (window.opener && !window.opener.closed) {
      window.setTimeout(() => window.close(), delayMs);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (error) {
      setStatus('error');
      setMessage(errorDescription || error);
      notifyOpener({ status: 'error', error: errorDescription || error });
      closeIfPopup(1200);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing authorization details from bank connection.');
      notifyOpener({
        status: 'error',
        error: 'Missing authorization details from bank connection.'
      });
      closeIfPopup(1200);
      return;
    }

    const run = async () => {
      setStatus('working');
      setMessage('Finalizing your bank connection...');
      try {
        bankConnectionService.setAuthTokenProvider(() => getToken());
        const connection = await bankConnectionService.handleOAuthCallback(code, state);
        setStatus('success');
        setMessage('Bank connection successful. You can now link your accounts.');
        notifyOpener({ status: 'success', connectionId: connection?.id });
        closeIfPopup(800);
      } catch (err) {
        logger.error('Banking callback failed', err as Error);
        setStatus('error');
        const errorMessage = err instanceof Error ? err.message : 'Unable to complete bank connection.';
        setMessage(errorMessage);
        notifyOpener({ status: 'error', error: errorMessage });
        closeIfPopup(1200);
      }
    };

    void run();
  }, [code, state, error, errorDescription, getToken, isLoaded, notifyOpener, closeIfPopup]);

  return (
    <PageWrapper title="Bank Connection">
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow p-8 text-center space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {status === 'success' ? 'Connected' : status === 'error' ? 'Connection Issue' : 'Connecting...'}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/settings/data')}
            className="px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-[#2d3a4d]"
          >
            Go to Bank Connections
          </button>
          <button
            onClick={() => navigate('/open-banking')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Back to Open Banking
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}
