/**
 * Who stands behind the privacy policy and the terms — in ONE place.
 *
 * The two legal pages describe what the software actually does, and that
 * part is kept true by whoever changes the software. What they cannot know
 * is who the operator is in law: the trading entity, its registered
 * address, the address a data-subject request goes to. Those are facts
 * about the business, not the code, and they are filled in here once, by
 * the owner, and read by both pages.
 *
 * While any placeholder below is still a placeholder, both pages say so at
 * the top rather than printing a bracket where a company name should be.
 * `LEGAL_REVIEW_COMPLETE` is the owner's switch for the review notice: it
 * is flipped after a solicitor has read the pages, or after the owner has
 * decided, consciously, to publish without one. Nothing else flips it.
 */

export const OPERATOR = {
  /** The legal name of the operator, e.g. "Example Trading Ltd" or "Steven Green, trading as Reckley". */
  legalName: '[OPERATOR LEGAL NAME]',
  /** The company number, or '' for a sole trader. */
  companyNumber: '',
  /** The registered or trading address, one line. */
  address: '[REGISTERED ADDRESS]',
  /** Where a privacy question or a data-subject request is sent. */
  contactEmail: '[CONTACT EMAIL]',
  /** Where a support question is sent; may be the same address. */
  supportEmail: '[SUPPORT EMAIL]',
} as const;

/** The day the wording last changed in substance. Refresh it with the wording. */
export const LEGAL_LAST_UPDATED = '23 October 2026';

/** True once a solicitor has reviewed both pages, or the owner has decided to publish without that review. */
export const LEGAL_REVIEW_COMPLETE = false;

const PLACEHOLDER = /^\[.*\]$/;

/** False while any operator detail is still a placeholder. */
export function operatorDetailsComplete(): boolean {
  return !PLACEHOLDER.test(OPERATOR.legalName) && !PLACEHOLDER.test(OPERATOR.address) && !PLACEHOLDER.test(OPERATOR.contactEmail) && !PLACEHOLDER.test(OPERATOR.supportEmail);
}

/** The operator as a sentence: name, company number where there is one. */
export function operatorLine(): string {
  return OPERATOR.companyNumber ? `${OPERATOR.legalName} (company number ${OPERATOR.companyNumber})` : OPERATOR.legalName;
}
