import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import PageWrapper from '../components/PageWrapper';
import { bankConnectionService } from '../services/bankConnectionService';
import type { BankConnection } from '../services/bankConnectionService';
import { RefreshCwIcon, AlertCircleIcon, LinkIcon } from '../components/icons';
import { formatDateTime } from '../utils/dateFormatter';
import LinkBankAccountsModal from '../components/banking/LinkBankAccountsModal';

type ConnectStatus = 'idle' | 'connecting' | 'error';

export default function OpenBanking() {
  const { getToken, isLoaded } = useClerkAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>('idle');
  const [connectError, setConnectError] = useState('');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [linkingConnectionId, setLinkingConnectionId] = useState<string | null>(null);
  // What a sync that ran but did not finish could not do. "Shown via connection
  // status" was never true of a healthy connection with an unfinished job —
  // e.g. accounts the bank gave no balance for, which are deliberately not
  // opened at a made-up figure and so simply are not there.
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      const result = await bankConnectionService.refreshConnections();
      setConnections(result);
    } catch {
      // Silent fail - connections list will be empty
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void loadConnections();
  }, [isLoaded, loadConnections]);

  // Listen for OAuth callback completion from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'wealthtracker:bank-oauth-complete') {
        void loadConnections();
        // Open linking modal if we have a connectionId from a successful OAuth flow
        if (event.data.status === 'success' && event.data.connectionId) {
          setLinkingConnectionId(event.data.connectionId);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadConnections]);

  /**
   * The same hand-off, for the redirect flow rather than the popup one.
   *
   * When the bank returns to a POPUP, the callback postMessages its
   * connectionId and the effect above opens the linking modal. When it returns
   * by full-page redirect there is no opener to message, so that hand-off was
   * simply lost: the callback said "you can now link your accounts" and the
   * user had to come back here and find the link button themselves. The
   * callback now sends the id in the URL instead, and this picks it up.
   *
   * The parameter is consumed immediately (replace, not push) so a refresh or
   * a back-button press does not re-open the modal for a connection the user
   * has already dealt with.
   */
  useEffect(() => {
    if (!isLoaded) return;
    const linkTarget = searchParams.get('link');
    if (!linkTarget) return;
    setLinkingConnectionId(linkTarget);
    const next = new URLSearchParams(searchParams);
    next.delete('link');
    setSearchParams(next, { replace: true });
  }, [isLoaded, searchParams, setSearchParams]);

  const handleConnectBank = useCallback(async () => {
    setConnectStatus('connecting');
    setConnectError('');
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      const result = await bankConnectionService.connectBank('', 'truelayer');
      if (result.url) {
        window.location.href = result.url;
      } else {
        setConnectStatus('error');
        setConnectError('No authorization URL returned from server.');
      }
    } catch (err) {
      setConnectStatus('error');
      setConnectError(err instanceof Error ? err.message : 'Failed to start bank connection.');
    }
  }, [getToken]);

  const handleSync = useCallback(async (connectionId: string) => {
    setSyncingIds(prev => new Set(prev).add(connectionId));
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      const result = await bankConnectionService.syncConnection(connectionId);
      setSyncNotice(result.success ? null : (result.errors[0] ?? 'The bank sync did not complete.'));
      await loadConnections();
    } catch {
      // A thrown sync failure flips the connection's own status (error /
      // reauth_required), which the list below shows.
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [getToken, loadConnections]);

  const handleDisconnect = useCallback(async (connectionId: string, institutionName: string) => {
    // A destructive control asks first, and the question states the
    // consequence — including what does NOT happen, because "disconnect"
    // reads scarier than it is: the accounts and every transaction stay.
    if (!window.confirm(
      `Disconnect ${institutionName}? Your accounts and their history stay exactly as they are — only the automatic feed stops. You can reconnect at any time.`
    )) {
      return;
    }
    setDeletingIds(prev => new Set(prev).add(connectionId));
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      await bankConnectionService.disconnect(connectionId);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch {
      // The connection's own status flips on a failed disconnect and the
      // list below shows it.
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [getToken]);

  /**
   * The remedy for a broken connection — a fresh authorisation with the
   * bank, through the same OAuth door the connection came in by. This is
   * what "Reconnect" on a stale row does; the redirect leaves the page.
   */
  const [reauthorizingIds, setReauthorizingIds] = useState<Set<string>>(new Set());
  const handleReauthorize = useCallback(async (connectionId: string) => {
    setReauthorizingIds(prev => new Set(prev).add(connectionId));
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      const result = await bankConnectionService.reauthorizeConnection(connectionId);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setSyncNotice('The bank did not offer a reconnection link. Try again, or disconnect and connect afresh.');
    } catch (err) {
      setSyncNotice(err instanceof Error ? err.message : 'Reconnecting failed. Try again.');
    } finally {
      setReauthorizingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [getToken]);

  const handleLinkComplete = useCallback(async (connectionId: string) => {
    setLinkingConnectionId(null);
    // After linking, sync transactions for the newly linked accounts
    setSyncingIds(prev => new Set(prev).add(connectionId));
    try {
      bankConnectionService.setAuthTokenProvider(() => getToken());
      await bankConnectionService.syncTransactionsOnly(connectionId);
      await loadConnections();
    } catch {
      // Sync errors shown via connection status
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }, [getToken, loadConnections]);

  return (
    <PageWrapper title="Open Banking">
      {/* NO STATS ROW, and NO "Security Status: Secured" (Design, 24 Aug
          §3). "Secured" was a claim in stock blue dressed as a measured
          status — the app measures nothing that could make it false, which
          is what a status is. And two count cards over a list of one to
          three connections restated the list. A total is earned by a
          question; the list below answers this page's. */}

      {/* Connect Bank */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6 mb-6">
        <h3 className="text-card font-semibold mb-2 text-gray-900 dark:text-white">Connect Your Bank</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Connect a bank and its transactions and balances arrive on their own — the feed keeps
          the accounts you link up to date.
        </p>
        <button
          type="button"
          onClick={handleConnectBank}
          disabled={connectStatus === 'connecting'}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-action text-on-primary-action rounded-lg hover:bg-primary-action-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <LinkIcon size={18} />
          {connectStatus === 'connecting' ? 'Redirecting to bank…' : 'Connect Bank Account'}
        </button>
        {connectStatus === 'error' && connectError && (
          <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircleIcon size={16} />
            <span>{connectError}</span>
          </div>
        )}
        {/* One sentence of FACT where the decision is made — not the
            landing-page security card this page used to end with (Design §3:
            reassurance the user has already bought). */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Access is read-only, through an FCA-regulated Open Banking provider, and a
          connection can be removed at any time.
        </p>
      </div>

      {/* A sync that ran but could not finish the job. Amber, not red: the
          connection works and syncing again usually completes it. */}
      {syncNotice && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">Bank sync incomplete</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{syncNotice}</p>
            </div>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-sm text-amber-700 dark:text-amber-300 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Connected Banks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6 mb-6">
        <h3 className="text-card font-semibold mb-4 text-gray-900 dark:text-white">Connected Banks</h3>
        {isLoading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading connections…</p>
        ) : connections.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No bank connections yet. Click &ldquo;Connect Bank Account&rdquo; to get started.</p>
        ) : (
          <div className="space-y-3">
            {connections.map(connection => {
              const broken = connection.status === 'error' || connection.status === 'reauth_required';
              return (
              <div
                key={connection.id}
                // The house attention mark, not a red caption (Design §3):
                // a 3px rail down the leading edge on the rows that need
                // work — the same idiom the reconciliation rows wear. A dead
                // feed is the highest-stakes broken state on this page and
                // it reads like one now.
                className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg border-l-[3px] ${
                  broken ? 'border-l-amber-400 dark:border-l-amber-500' : 'border-l-transparent'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{connection.institutionName}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        {connection.accountsCount ?? 0} account{(connection.accountsCount ?? 0) !== 1 ? 's' : ''}
                      </span>
                      {connection.lastSync && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">&middot;</span>
                          {/* The house date words, not the US locale default
                              with seconds (Design §3): every other surface
                              says "24 Aug 2026". */}
                          <span>Last synced {formatDateTime(connection.lastSync)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* LABELLED quiet controls, not four bare icons at one
                      weight (Design §3, the Accounts ruling from the 13th).
                      A healthy connection carries no tick — the absence of
                      trouble needs no signal. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {broken && (
                      <button
                        type="button"
                        onClick={() => void handleReauthorize(connection.id)}
                        disabled={reauthorizingIds.has(connection.id)}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-400 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:border-amber-500 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800 disabled:opacity-50 transition-colors"
                      >
                        {reauthorizingIds.has(connection.id) ? 'Redirecting…' : 'Reconnect'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setLinkingConnectionId(connection.id)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      Link accounts
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSync(connection.id)}
                      disabled={syncingIds.has(connection.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCwIcon size={14} className={syncingIds.has(connection.id) ? 'animate-spin' : ''} />
                      {syncingIds.has(connection.id) ? 'Syncing…' : 'Sync'}
                    </button>
                    {/* The destructive action says its name and stands apart
                        by INK, not by being one more grey icon. It asks
                        first, and the question states the consequence. */}
                    <button
                      type="button"
                      onClick={() => handleDisconnect(connection.id, connection.institutionName)}
                      disabled={deletingIds.has(connection.id)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    >
                      {deletingIds.has(connection.id) ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </div>
                </div>
                {/* THE CONSEQUENCE, THEN THE REMEDY (Design §3: a dead feed
                    silently staling every balance was a red caption with
                    neither). This is the source of the amber the Accounts
                    page shows. */}
                {broken && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">
                      This connection has stopped working.
                    </span>{' '}
                    Balances and transactions from {connection.institutionName} are no longer
                    arriving, so the accounts it feeds are going stale
                    {connection.lastSync ? ` — nothing has come in since ${formatDateTime(connection.lastSync)}` : ''}.
                    Reconnect to authorise it again and the feed resumes.
                    {connection.status === 'error' && connection.error ? (
                      <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">
                        The provider said: {connection.error}
                      </span>
                    ) : null}
                  </p>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How it works — EARNED FURNITURE: an explainer for a flow the reader
          has not used yet, so it appears only while there is no connection.
          Someone with a working feed does not need three tiles restating what
          their own list above demonstrates. Neutral step markers — a number
          is not a signal (Design §3: the blue circles and the shield were the
          pre-pass palette). The "Bank-Level Security" marketing card that
          used to end this page is gone outright; its one factual sentence
          lives under the Connect button, where the decision is made. */}
      {!isLoading && connections.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-line dark:border-gray-700 p-6 mb-6">
          <h3 className="text-card font-semibold mb-4 text-gray-900 dark:text-white">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {([
              ['1', 'Connect', 'Choose your bank and authorise read-only access through Open Banking.'],
              ['2', 'Link', 'Match each bank account to the account it feeds here — or create one.'],
              ['3', 'Stay current', 'Transactions and balances arrive on their own from then on.'],
            ] as const).map(([step, title, body]) => (
              <div key={step} className="text-center">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-gray-600 dark:text-gray-300 font-bold">{step}</span>
                </div>
                <h4 className="font-medium mb-1 text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Link Bank Accounts Modal */}
      {linkingConnectionId && (
        <LinkBankAccountsModal
          isOpen={true}
          onClose={() => setLinkingConnectionId(null)}
          connectionId={linkingConnectionId}
          onLinkComplete={handleLinkComplete}
        />
      )}
    </PageWrapper>
  );
}
