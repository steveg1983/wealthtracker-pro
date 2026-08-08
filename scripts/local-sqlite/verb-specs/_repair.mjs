// The scenario `repair_claimed_transfer` exists for, assembled once.
//
// The counterpart (+15.00, Rainy day) is linked to the WRONG partner (−15.00,
// Everyday). The row that really matches it — same account as the partner, same
// day, exact negation, unfiled — is STRANDED. Everyday ends at −55.00 and Rainy
// day at 15.00, so B-1 holds on both before the verb runs.
import { transferPair, adjustmentCategory, strandedRow, setups, ADJUSTMENT, STRANDED,
  OTHER_LEG, THIS_LEG } from './_shared.mjs';

export const claimedTransfer = setups(transferPair, adjustmentCategory, strandedRow);

/** The RPC's three roles, named so a payload reads as what it means. */
export const COUNTERPART = THIS_LEG;   // linked to the wrong partner
export const PARTNER = OTHER_LEG;      // the row this repair displaces
export { STRANDED, ADJUSTMENT };

export function repairPayload(overrides = {}) {
  return {
    stranded_id: STRANDED,
    counterpart_id: COUNTERPART,
    partner_id: PARTNER,
    adjustment_category_id: ADJUSTMENT,
    user_id: '11111111-1111-1111-1111-111111111111',
    ...overrides,
  };
}
