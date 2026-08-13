/**
 * What counts as "clicked outside" a dialog.
 *
 * ─ THE BUG THIS EXISTS TO CATCH ────────────────────────────────────────────
 * Selecting text inside a modal and releasing the mouse a few pixels outside it
 * threw the dialog away, losing whatever had been typed. The owner hit it on
 * Account Settings while selecting an institution name; because the dismissal
 * lives in this shared component, it was live on all 35 surfaces that use it.
 *
 * The cause is that a browser attributes a `click` to the nearest common
 * ancestor of where the button went DOWN and where it came UP. Press inside the
 * panel, release over the backdrop, and the common ancestor is the backdrop
 * container — so `e.target === e.currentTarget` was true and the modal read a
 * text selection as a dismissal.
 *
 * ─ WHY THE TESTS LOOK LIKE THIS ────────────────────────────────────────────
 * Every case here fires the WHOLE gesture — pointerdown somewhere, click
 * somewhere — because a test that fires only `click` cannot tell the two apart
 * and would have passed against the broken code. That is the same lesson the
 * dashboard's period menu taught the hard way: a click is five events, and the
 * last one on its own is not the gesture.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

/** The full-screen container that owns the dismissal, as the DOM sees it. */
const backdrop = (): HTMLElement => {
  const dialog = screen.getByRole('dialog');
  const container = dialog.parentElement;
  if (!(container instanceof HTMLElement)) throw new Error('dialog has no container');
  return container;
};

const open = (onClose: () => void) =>
  render(
    <Modal isOpen onClose={onClose} title="Account Settings">
      <input aria-label="Institution" defaultValue="Investec" />
    </Modal>
  );

describe('dismissing a modal by clicking outside it', () => {
  it('closes when the press AND the release are both outside', () => {
    const onClose = vi.fn();
    open(onClose);

    fireEvent.pointerDown(backdrop());
    fireEvent.click(backdrop());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when a selection starts inside and ends outside', () => {
    // The reported bug, in one test. The click lands on the container because
    // that is the common ancestor of the two ends of the drag — which is not
    // the same statement as "the user clicked outside".
    const onClose = vi.fn();
    open(onClose);

    fireEvent.pointerDown(screen.getByLabelText('Institution'));
    fireEvent.click(backdrop());

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on a click inside the panel', () => {
    const onClose = vi.fn();
    open(onClose);

    fireEvent.pointerDown(screen.getByLabelText('Institution'));
    fireEvent.click(screen.getByLabelText('Institution'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('forgets the press, so the NEXT outside click still dismisses', () => {
    // The flag has to be cleared or one drag-out would arm the dialog against
    // every later dismissal — a bug fix that quietly breaks the feature.
    const onClose = vi.fn();
    open(onClose);

    fireEvent.pointerDown(screen.getByLabelText('Institution'));
    fireEvent.click(backdrop());
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(backdrop());
    fireEvent.click(backdrop());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never dismisses on the backdrop when the caller has forbidden it', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Importing" closeOnBackdrop={false}>
        <p>Do not interrupt</p>
      </Modal>
    );

    fireEvent.pointerDown(backdrop());
    fireEvent.click(backdrop());

    expect(onClose).not.toHaveBeenCalled();
  });
});
