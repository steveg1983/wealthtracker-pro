/**
 * What an OFX row is CALLED, and what goes in its notes.
 *
 * The owner's HSBC statement (29 Sep 2026): the file's NAME is the payee the
 * bank prints — "PAYPAL PAYMENT", "PIZZA FEDERICCI" — and its MEMO is the
 * channel or the place — "DD", "SEVENOAKS )))". The importer read
 * `memo || name`, so the register showed a column of "DD"s, and every row's
 * notes began with a 31-digit FITID nobody asked for.
 */
import { describe, it, expect } from 'vitest';
import { ofxImportService, memoWorthKeeping } from '../ofxImportService';
import type { Account } from '../../types';

const ACCOUNT_ID = 'acc-hsbc';
const accounts: Account[] = [
  { id: ACCOUNT_ID, name: 'HSBC Premier Current Account', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date('2026-09-01') }
];

const stmtTrn = (fitId: string, amount: string, name: string | null, memo: string | null): string => `<STMTTRN>
<TRNTYPE>OTHER
<DTPOSTED>20260921000000
<TRNAMT>${amount}
<FITID>${fitId}
${name === null ? '' : `<NAME>${name}`}
${memo === null ? '' : `<MEMO>${memo}`}
</STMTTRN>`;

const ofxFile = (transactions: string[]): string => `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>GBP
<BANKACCTFROM>
<BANKID>401841
<ACCTID>40184182195747
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
${transactions.join('\n')}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

describe('an OFX row is called by its payee, and its memo is a note', () => {
  it('NAME is the description; a bare type-code memo is dropped, a reference is kept, the FITID is nowhere', async () => {
    const file = ofxFile([
      stmtTrn('2026092122026261025354760470000', '-44.99', 'PAYPAL PAYMENT', 'DD'),
      stmtTrn('2026092132026264145447039600000', '-90.00', 'Giant Ventures Gro', '83 SAG BP'),
      stmtTrn('2026091832026261160244400010000', '-15.50', 'PIZZA FEDERICCI', 'SEVENOAKS )))')
    ]);
    const result = await ofxImportService.importTransactions(file, accounts, [], { accountId: ACCOUNT_ID, autoCategorize: false });

    const byDescription = new Map(result.transactions.map(t => [t.description, t.notes ?? '']));
    expect([...byDescription.keys()]).toEqual(['PAYPAL PAYMENT', 'Giant Ventures Gro', 'PIZZA FEDERICCI']);
    expect(byDescription.get('PAYPAL PAYMENT')).toBe('');
    expect(byDescription.get('Giant Ventures Gro')).toBe('83 SAG BP');
    expect(byDescription.get('PIZZA FEDERICCI')).toBe('SEVENOAKS )))');
    for (const notes of byDescription.values()) expect(notes).not.toMatch(/FITID/);
  });

  it('a row with no NAME is called by its memo, and never "Unknown" while a memo exists', async () => {
    const file = ofxFile([stmtTrn('f1', '-5.00', null, 'CASH BNKM SEP26'), stmtTrn('f2', '-6.00', null, null)]);
    const result = await ofxImportService.importTransactions(file, accounts, [], { accountId: ACCOUNT_ID, autoCategorize: false });
    expect(result.transactions.map(t => t.description)).toEqual(['CASH BNKM SEP26', 'Unknown']);
    // The memo that became the description is not repeated as a note.
    expect(result.transactions[0].notes ?? '').toBe('');
  });

  it('memoWorthKeeping: repeats and bare codes are not notes; references and places are', () => {
    expect(memoWorthKeeping('DD', 'PAYPAL PAYMENT')).toBe(false);
    expect(memoWorthKeeping('CR', 'ALLWYN ENT LTD')).toBe(false);
    expect(memoWorthKeeping('VIS', 'SCOTTISH POWER')).toBe(false);
    expect(memoWorthKeeping('paypal payment', 'PAYPAL PAYMENT')).toBe(false);
    expect(memoWorthKeeping(undefined, 'X')).toBe(false);
    expect(memoWorthKeeping('   ', 'X')).toBe(false);
    expect(memoWorthKeeping('Loan BP', 'Gemma Green')).toBe(true);
    expect(memoWorthKeeping('S GREEN CR', 'GREEN STEVEN')).toBe(true);
    expect(memoWorthKeeping('PLYMOUTH VIS', 'WWW.ARC-LED.CO.UK')).toBe(true);
    expect(memoWorthKeeping('SHELL GODSTO@13:27 ATM', 'CASH BNKM    SEP26')).toBe(true);
  });
});
