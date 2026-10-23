/**
 * The frame both legal pages share: the way back, the title, the date, and
 * the two notices that are true until the owner makes them untrue — the
 * operator's details still being placeholders, and the review not yet done.
 * The wording of each page is its own; this is only the chrome around it.
 */

import { Link } from 'react-router-dom';
import { LEGAL_LAST_UPDATED, LEGAL_REVIEW_COMPLETE, operatorDetailsComplete } from './legalIdentity';

export const H2 = 'text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3';
export const H3 = 'text-base font-semibold text-gray-900 dark:text-white mt-5 mb-2';
export const P = 'text-gray-700 dark:text-gray-300 mb-3 leading-relaxed';
export const UL = 'list-disc pl-6 mb-3';
export const LI = 'text-gray-700 dark:text-gray-300 mb-1';

export default function LegalPage({ title, children, seeAlso }: {
  title: string;
  children: React.ReactNode;
  seeAlso: { to: string; label: string };
}): React.JSX.Element {
  const detailsMissing = !operatorDetailsComplete();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          ← Back to Reckley
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: {LEGAL_LAST_UPDATED}</p>

        {(detailsMissing || !LEGAL_REVIEW_COMPLETE) && (
          <div role="note" className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-8">
            <p className="text-sm text-yellow-900 dark:text-yellow-200 font-medium">
              {detailsMissing
                ? 'This page describes what Reckley does accurately, but the operator’s legal details have not been filled in yet and it has not been reviewed by a solicitor. It is published for transparency while that is completed.'
                : 'This page describes what Reckley does accurately and names the operator. It has not yet been reviewed by a solicitor.'}
            </p>
          </div>
        )}

        {children}

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-12">
          See also our <Link to={seeAlso.to} className="underline">{seeAlso.label}</Link>.
        </p>
      </div>
    </div>
  );
}
