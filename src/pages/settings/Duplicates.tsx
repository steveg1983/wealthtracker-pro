/**
 * Duplicates — a page under Manage, not a tool buried in Data Management.
 *
 * The owner's ruling (28 Aug): finding the same payment recorded twice is
 * an everyday tidying job, and it belongs beside Categories, Payees and
 * Transfer Links — the things you go and manage — rather than under the
 * page that also holds backups, archiving and the danger zone.
 *
 * The sweep itself is unchanged: DuplicateSweepModal does the work and
 * keeps its own resume crumbs, and this page opens it on arrival. A page
 * that exists only to host a modal is deliberate — the modal is the
 * feature, and Manage's other items are pages, so the nav stays coherent.
 */
import { useEffect, useState, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { lazyWithRecovery } from '../../utils/lazyWithRecovery';
import { readDuplicateSweepSession, type DuplicateSweepSession } from '../../utils/duplicateSweepSession';
import PageWrapper from '../../components/PageWrapper';

const DuplicateSweepModal = lazyWithRecovery(() => import('../../components/DuplicateSweepModal'));

export default function Duplicates(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [resume, setResume] = useState<DuplicateSweepSession | null>(null);

  /**
   * A sweep the reader walked away from and came back to — the crumbs ride
   * the navigation state, exactly as they did on Data Management.
   */
  useEffect(() => {
    const session = readDuplicateSweepSession(location.state);
    if (session === null) return;
    setResume(session);
    setIsOpen(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  return (
    <PageWrapper title="Duplicates">
      <p className="text-body text-gray-500 dark:text-gray-400">
        The same payment recorded twice — from an import, a feed, or a row typed by hand.
      </p>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-4 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary transition-colors"
        >
          Find duplicates
        </button>
      )}
      {isOpen && (
        <Suspense fallback={null}>
          <DuplicateSweepModal
            isOpen={isOpen}
            resume={resume}
            onClose={() => {
              setIsOpen(false);
              // Closing ends the sitting: the next open starts fresh rather
              // than restoring a place the user has just walked away from.
              setResume(null);
            }}
          />
        </Suspense>
      )}
    </PageWrapper>
  );
}
