import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supportedCurrencies } from '../utils/currency';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (name: string, currency: string) => void;
}

export default function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps): React.JSX.Element | null {
  const [firstName, setFirstName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('GBP');
  const modalRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (firstName.trim()) {
      onComplete(firstName.trim(), baseCurrency);
    }
  };

  // The comment that used to sit here said "no scroll prevention — the modal
  // will stay fixed in the viewport automatically, no need to prevent
  // scrolling". Re-checked after the portal rewrite: the PREMISE is still true
  // — this is `position: fixed` and portalled to `document.body`, so nothing
  // the page does underneath can move it — but it answers a question nobody
  // asked. Whether the modal moves was never the risk; whether the PAGE moves
  // behind it is. On a phone, focusing either field opens the keyboard and
  // scrolls the document, so the app slid around behind a sheet that cannot be
  // dismissed (there is no close control here, and the backdrop deliberately
  // swallows its own clicks). Locking it is the fix the old comment reasoned
  // its way past.
  //
  // The lock is `components/common/Modal.tsx`'s, verbatim and for its reasons:
  // `overflow: hidden` alone does not hold iOS Safari, so the body is pinned
  // at its current offset and the offset is given back on the way out. Every
  // original value is captured rather than reset to '', because a blank is not
  // the same as "whatever it was".
  useEffect(() => {
    if (!isOpen) return undefined;

    const { body } = document;
    const original = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width
    };
    const scrollY = window.scrollY;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = original.position;
      body.style.top = original.top;
      body.style.width = original.width;
      body.style.overflow = original.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Render modal using React Portal at document.body level
  // This ensures the modal is outside any transformed parents
  return createPortal(
    <>
      {/* The backdrop was sized `width: 100vw; height: 100vh`, and both of those
          are wrong in the same way: they are ARITHMETIC against a viewport,
          where what is wanted is simply "the whole of it".

          `100vh` is the LARGE viewport — the height the page would have if
          every retractable browser chrome were retracted — so with an address
          bar on screen the dim ran off the bottom of what you can actually
          see. The modal is a sibling, not a child, and centres itself with
          `top: 50%` against the fixed containing block, which IS the visible
          box. So the two disagreed: the dim's true middle sat below the modal's
          middle, and the sheet read as pinned high on every phone. That is the
          §4 finding, and it is the backdrop that is wrong rather than the
          modal. `100vw` is the same class of error one axis over — it counts
          the classic scrollbar, so on a desktop browser the dim was a dozen
          pixels wider than the window and could provoke a horizontal scroll.

          `inset: 0` over `100dvh`: `dvh` would track the visible height, but it
          only fixes the axis it is applied to, it reflows as the address bar
          slides, and it still leaves `100vw` to deal with. Anchoring all four
          edges resolves against exactly the box the modal is already centring
          itself in — one declaration, both axes, no units to be wrong about,
          and no support question. */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 99998
        }}
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Modal centered in viewport using fixed positioning */}
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '448px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
          zIndex: 99999,
          animation: 'fadeInScale 0.3s ease-out'
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Welcome to WealthTracker
          </h2>
        </div>

        {/* The one moment to say what this is. The copy here used to be
            friendly-generic ("let's personalize your experience"), which
            describes any app at all — so the first thing a new user read told
            them nothing about the one they had just opened
            (DESIGN_PASS_2026-08 §3.4). Each field now also says what the app
            DOES with the answer. */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Two answers and you're in. This is a dense, keyboard-driven ledger:
          your figures stay yours, and every report says what it leaves out.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What's your first name?
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
              placeholder="Enter your first name"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              It greets you on the dashboard. That is all it is used for.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred base currency
            </label>
            <select
              aria-label="Preferred base currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
            >
              {supportedCurrencies.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.symbol} {curr.name} ({curr.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Every total is shown in this currency — net worth, group totals,
              reports. Individual accounts keep their own.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 justify-center px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
            >
              Get Started
            </button>
          </div>
        </form>

        {/* A tinted, bordered, rounded panel for one reassuring sentence — the
            blue-pill finding one surface over (DESIGN_PASS §P2: colour is a
            signal, never a surface). Blue means nothing in this product, so a
            blue box spends a signal to say something entirely undramatic. A
            hairline and a quiet grey separate it from the form just as well,
            and cost nothing that is needed later. */}
        <p className="mt-6 border-t border-line dark:border-gray-700 pt-4 text-xs text-gray-500 dark:text-gray-400">
          Both can be changed later in Settings → App Settings.
        </p>
      </div>
    </>,
    document.body
  );
}