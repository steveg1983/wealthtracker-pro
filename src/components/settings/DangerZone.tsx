/**
 * DangerZone — self-service account deletion (GDPR Art. 17 right to erasure).
 *
 * Calls POST /api/account/delete, which cancels Stripe billing, erases every
 * database row for the user (the users-row cascade covers all financial
 * tables), and removes the Clerk identity. The user must type the
 * confirmation phrase; the API independently enforces the same phrase.
 */

import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AlertTriangleIcon } from '../icons';

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

export default function DangerZone(): React.JSX.Element {
  const { getToken, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const phraseMatches = confirmText === CONFIRMATION_PHRASE;

  const handleDelete = async () => {
    if (!phraseMatches || isDeleting) return;
    setIsDeleting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setError('Your session has expired — please sign in again.');
        setIsDeleting(false);
        return;
      }

      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: CONFIRMATION_PHRASE })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setError(payload.error || 'Account deletion failed — please try again.');
        setIsDeleting(false);
        return;
      }

      // Clear everything client-side and end the session.
      try {
        localStorage.clear();
        sessionStorage.clear();
        if (window.indexedDB?.databases) {
          const dbs = await window.indexedDB.databases();
          dbs.forEach((db) => db.name && window.indexedDB.deleteDatabase(db.name));
        }
      } catch {
        // Best-effort local cleanup; server-side data is already gone.
      }

      await signOut({ redirectUrl: '/' });
    } catch {
      setError('Account deletion failed — please check your connection and try again.');
      setIsDeleting(false);
    }
  };

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 border-2 border-red-200 dark:border-red-900/50"
    >
      <h2 id="danger-zone-heading" className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
        <AlertTriangleIcon size={20} aria-hidden="true" />
        Danger zone
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Permanently delete your account: every transaction, account, budget, goal,
        and document, your bank connections, your subscription, and your sign-in.
        This cannot be undone.
      </p>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          Delete my account…
        </button>
      ) : (
        <div className="space-y-3">
          <label htmlFor="delete-confirmation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type <span className="font-mono font-semibold">{CONFIRMATION_PHRASE}</span> to confirm
          </label>
          <input
            id="delete-confirmation"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
          />
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setExpanded(false); setConfirmText(''); setError(null); }}
              disabled={isDeleting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!phraseMatches || isDeleting}
              className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting…' : 'Permanently delete my account'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
