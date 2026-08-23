import React from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';

/**
 * The follow-up to a refusal: "and never again?"
 *
 * Refusing a suggestion used to be a decision for that sitting only — the row
 * dropped out of the list, nothing was written, and the next sweep offered the
 * same pairing again. On a long history that means the same rejections have to
 * be made over and over, which is the complaint this prompt answers.
 *
 * Deliberately a SECOND question rather than a change to the first: "not a
 * pair" and "never show me this again" are different statements, and a user who
 * only meant the first must not have the second saved for them. So the default
 * is still the old behaviour, and the persistent answer costs one deliberate
 * tap — with what it will do said before it happens, and where to undo it said
 * in the same breath.
 */

interface Props {
  isOpen: boolean;
  /** What was refused, as it reads mid-sentence: "this pairing", "this row". */
  subject: string;
  /** What answering No leaves behind — the existing, session-only behaviour. */
  keepingMeans: string;
  /** Where the undo lives, named exactly as the section is labelled. */
  undoLocation?: string;
  saving: boolean;
  /**
   * What the Yes button should say while it waits, when "Saving…" is not
   * enough. A refusal about several things at once is several writes, and a
   * button that says the same word throughout looks stuck rather than busy —
   * so a caller with a batch can put its progress here. Left off, the button
   * reads exactly as it always has.
   */
  savingLabel?: string;
  onKeep: () => void;
  onDismiss: () => void;
}

export default function DismissSuggestionPrompt({
  isOpen,
  subject,
  keepingMeans,
  undoLocation = 'Dismissed suggestions',
  saving,
  savingLabel,
  onKeep,
  onDismiss,
}: Props): React.JSX.Element {
  return (
    <Modal
      isOpen={isOpen}
      // Closing without answering is the same as answering No: the refusal
      // stands for this sitting, and nothing is remembered.
      onClose={saving ? () => {} : onKeep}
      closeOnBackdrop={!saving}
      title="Leave it out in future?"
      size="md"
    >
      <ModalBody>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Do you want {subject} eliminated from this report in future?
        </p>
        <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>
            <strong className="text-gray-900 dark:text-white">Yes</strong> — {subject} is
            remembered as refused, and no sweep will offer it again. Nothing is deleted and
            nothing is changed: every transaction stays exactly as it is. You can bring it back
            at any time from <strong>{undoLocation}</strong> at the foot of this list.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">No</strong> — {keepingMeans}, and
            it will be offered again the next time you run this.
          </li>
        </ul>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onKeep}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            No — just this once
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (savingLabel ?? 'Saving…') : 'Yes — never offer it again'}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
