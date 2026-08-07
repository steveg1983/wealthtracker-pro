import React, { useState, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { ofxImportService } from '../services/ofxImportService';
import {
  planAccountDetailsBackfill,
  readOfxAccountIdentifiers
} from '../utils/ofxAccountIdentifiers';
import { keepLastFour } from '../utils/accountNumberInput';
import { formatStatementDay, planStatementBankBalance } from '../utils/statementBankBalance';
import {
  findStatementDuplicates,
  type IncomingStatementRow,
  type StatementDuplicateMatch
} from '../utils/statementDuplicates';
import { formatShortDate } from '../utils/dateFormatter';
// The account's OWN currency, not the user's display currency: a statement
// states a figure in the currency the account is held in, and the reconciliation
// screen compares it in that currency too.
import { formatCurrency } from '../utils/currency-decimal';
import { Modal } from './common/Modal';
import {
  UploadIcon,
  FileTextIcon,
  CheckIcon,
  AlertCircleIcon,
  InfoIcon,
  LinkIcon,
  UnlinkIcon,
  RefreshCwIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';
import AccountSelector from './common/AccountSelector';
import type { Account } from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('OFXImportModal');

interface OFXImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportTransactionsResult = Awaited<ReturnType<typeof ofxImportService.importTransactions>>;

/** One "you may already have this" pairing, with both sides ready to render. */
interface DuplicateReviewRow {
  incoming: IncomingStatementRow;
  match: StatementDuplicateMatch;
}

type ImportOutcome =
  | {
      success: true;
      imported: number;
      duplicates: number;
      /** How many of those the user looked at and chose to leave out. */
      reviewedOut: number;
      account: Account | null;
      /** Set when the import also filled in the account's blank bank details. */
      savedDetails?: { accountName: string; summary: string };
      /** Set when saving those details failed — the transactions still landed. */
      savedDetailsError?: string;
      /** Set when the statement's closing balance became the Bank Balance. */
      bankBalance?: { amount: string; dateAsOf: string };
      /** Set when writing that balance failed — the transactions still landed. */
      bankBalanceError?: string;
    }
  | {
      success: false;
      error: string;
    };

export default function OFXImportModal({ isOpen, onClose }: OFXImportModalProps): React.JSX.Element {
  const { accounts, transactions, categories, addTransaction, updateAccount } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ImportTransactionsResult | null>(null);
  const [importResult, setImportResult] = useState<ImportOutcome | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  /**
   * Whether the destination account is the user's own choice rather than the
   * importer's guess. It decides the DEFAULT for saving the file's details
   * onto the account: an account someone picked by name is a decision, while
   * the automatic match can be nothing more than "the only savings account
   * you have", which is not something to write onto a record permanently.
   */
  const [accountIsUserChoice, setAccountIsUserChoice] = useState(false);
  /** null = follow the default above; true/false = the user said so. */
  const [saveDetailsOverride, setSaveDetailsOverride] = useState<boolean | null>(null);
  /**
   * FITIDs of rows the duplicate check flagged and the user overruled. Cleared
   * whenever the file or the destination account changes, because a decision
   * made about one account's register says nothing about another's.
   */
  const [importAnywayFitIds, setImportAnywayFitIds] = useState<ReadonlySet<string>>(() => new Set());

  const parseFile = useCallback(async (targetFile: File) => {
    setIsProcessing(true);

    try {
      const content = await targetFile.text();
      const result = await ofxImportService.importTransactions(
        content,
        accounts,
        transactions,
        {
          skipDuplicates: false,
          categories,
          autoCategorize: true
        }
      );

      setParseResult(result);

      if (result.matchedAccount) {
        setSelectedAccountId(result.matchedAccount.id);
      }
    } catch (error) {
      logger.error('Error parsing OFX file', error);
      alert('Error parsing OFX file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  }, [accounts, categories, transactions]);

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  // What the file says about its own account, in the only forms fit to show
  // anyone: a sort code, and the last 4 digits. Never the whole number — on a
  // card statement that is the full card number.
  const fileLastFour = parseResult?.ofxAccount
    ? keepLastFour(parseResult.ofxAccount.accountId)
    : '';
  const fileSortCode = parseResult?.ofxAccount
    ? readOfxAccountIdentifiers(parseResult.ofxAccount).sortCode ?? ''
    : '';

  // What this file could fill in on the chosen account — null whenever there
  // is nothing to add, which is most of the time: details already recorded,
  // details that disagree with the file, or a file of the wrong kind.
  const detailsToSave = useMemo(() => {
    if (!parseResult?.ofxAccount || !selectedAccount) return null;
    return planAccountDetailsBackfill(parseResult.ofxAccount, selectedAccount);
  }, [parseResult, selectedAccount]);

  // An identifier match is the account's own recorded sort code / account
  // number, so it is as good as the user pointing at it.
  const matchIsCertain =
    parseResult?.matchConfidence === 'identifier' &&
    parseResult.matchedAccount?.id === selectedAccountId;

  // What this file would do to the account's Bank Balance — the figure
  // Reconciliation measures against, and the reason finalising means anything.
  // Worked out here so the preview can state it before the user commits, and
  // again at import time against the account the money actually went into.
  const bankBalancePlan = useMemo(
    () =>
      planStatementBankBalance(parseResult?.statementBalance, selectedAccount, {
        // The destination is on screen with the figure next to it, and Import
        // is disabled until an account is chosen — this is not a silent guess.
        destinationConfirmed: true
      }),
    [parseResult, selectedAccount]
  );

  // Automatic when the destination is a decision (the user picked it, or the
  // account's own recorded details are the file's), off when it is a guess.
  const saveDetailsByDefault = accountIsUserChoice || matchIsCertain;
  const saveDetails = detailsToSave !== null && (saveDetailsOverride ?? saveDetailsByDefault);

  // One line about the consequence, or nothing at all. Only rendered once a
  // destination is chosen, because until then there is no account to talk about.
  const bankBalanceNotice = useMemo((): string | null => {
    if (!parseResult || !selectedAccount) return null;

    if (bankBalancePlan.kind === 'set') {
      return `${selectedAccount.name}'s Bank Balance will be set to ${formatCurrency(bankBalancePlan.amount, selectedAccount.currency)}, as at ${formatStatementDay(bankBalancePlan.dateAsOf)} — the figure Reconciliation checks your cleared transactions against.`;
    }

    if (bankBalancePlan.kind === 'stale') {
      return `${selectedAccount.name}'s Bank Balance will be left as it is: it already holds ${formatCurrency(bankBalancePlan.recordedBalance, selectedAccount.currency)} dated ${formatStatementDay(bankBalancePlan.recordedDate)}, which is later than this statement.`;
    }

    return `This file doesn't state a closing balance, so ${selectedAccount.name}'s Bank Balance stays as it is and Reconciliation has nothing to check these transactions against. You can enter it there by hand.`;
  }, [bankBalancePlan, parseResult, selectedAccount]);

  // Which of this file's rows the chosen account already holds. Recomputed
  // here rather than taken from the parse, because the destination is the
  // user's to change and the answer is different for every account.
  const duplicatePlan = useMemo(() => {
    if (!parseResult || !selectedAccountId) return null;
    return findStatementDuplicates(parseResult.statementRows, transactions, selectedAccountId);
  }, [parseResult, selectedAccountId, transactions]);

  /** The bank's own id on both sides — proof, so these are simply counted. */
  const alreadyImportedCount = duplicatePlan?.certain.length ?? 0;

  /** Same day, same pence, different words. Evidence, so these get reviewed. */
  const reviewRows = useMemo((): DuplicateReviewRow[] => {
    if (!parseResult || !duplicatePlan) return [];
    return duplicatePlan.possible.map(match => ({
      incoming: parseResult.statementRows[match.incomingIndex],
      match
    }));
  }, [duplicatePlan, parseResult]);

  const keptOut = reviewRows.filter(
    row => row.match.fitId === null || !importAnywayFitIds.has(row.match.fitId)
  ).length;

  const willImport = parseResult
    ? parseResult.statementRows.length -
      (skipDuplicates ? alreadyImportedCount + keptOut : 0)
    : 0;

  const toggleImportAnyway = useCallback((fitId: string | null) => {
    if (fitId === null) return;
    setImportAnywayFitIds(previous => {
      const next = new Set(previous);
      if (next.has(fitId)) next.delete(fitId);
      else next.add(fitId);
      return next;
    });
  }, []);

  const handleAccountChange = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    setAccountIsUserChoice(true);
    setSaveDetailsOverride(null);
    setImportAnywayFitIds(new Set());
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;
    
    // Check file extension
    if (!uploadedFile.name.toLowerCase().endsWith('.ofx')) {
      alert('Please select an OFX file');
      return;
    }
    
    setFile(uploadedFile);
    setParseResult(null);
    setImportResult(null);
    setAccountIsUserChoice(false);
    setSaveDetailsOverride(null);
    setImportAnywayFitIds(new Set());

    // Parse the file
    parseFile(uploadedFile);
  }, [parseFile]);
  
  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.ofx')) {
      setFile(droppedFile);
      setParseResult(null);
      setImportResult(null);
      setAccountIsUserChoice(false);
      setSaveDetailsOverride(null);
      setImportAnywayFitIds(new Set());
      parseFile(droppedFile);
    }
  }, [parseFile]);
  
  // Process import
  const processImport = useCallback(async () => {
    if (!parseResult || !file) return;
    
    setIsProcessing(true);
    
    try {
      const content = await file.text();
      const result = await ofxImportService.importTransactions(
        content,
        accounts,
        transactions,
        {
          accountId: selectedAccountId || undefined,
          skipDuplicates,
          categories,
          autoCategorize: true,
          // Only the rows on the review list above, and only the ones ticked.
          importAnywayFitIds: [...importAnywayFitIds]
        }
      );
      
      // Add transactions
      for (const transaction of result.transactions) {
        addTransaction(transaction);
      }

      const account = result.matchedAccount ?? accounts.find(a => a.id === selectedAccountId) ?? null;

      // Fill in the account's blank bank details from the file, but only ever
      // on the account the transactions themselves just went into, and only
      // after they landed — an import that failed must not leave an edited
      // account behind. The plan is worked out again here against that real
      // destination rather than reused from the preview, so what gets written
      // is decided by where the money went.
      let savedDetails: { accountName: string; summary: string } | undefined;
      let savedDetailsError: string | undefined;
      const plan = saveDetails && account
        ? planAccountDetailsBackfill(result.ofxAccount, account)
        : null;

      if (plan && account) {
        try {
          await updateAccount(account.id, plan.updates);
          savedDetails = { accountName: account.name, summary: plan.summary };
        } catch (error) {
          // The transactions are already in. Say so rather than failing the
          // whole import over a detail the user can still type in by hand.
          logger.error('Failed to save bank details from OFX file', error);
          savedDetailsError = `Couldn't save ${plan.summary} to ${account.name}. The transactions imported fine — you can add the details in the account's settings.`;
        }
      }

      // The statement's closing balance becomes the account's Bank Balance,
      // exactly as a bank feed's would. ONLY bankBalance and its date are
      // written — never `balance`, which is the ledger the transactions above
      // have already moved; writing the statement total on top of it would
      // count the same money twice.
      //
      // Recomputed against the real destination for the same reason the
      // details plan is, and kept as its own write so that a failure here
      // cannot be mistaken for a failure to save the bank details.
      let bankBalance: { amount: string; dateAsOf: string } | undefined;
      let bankBalanceError: string | undefined;
      const balancePlan = planStatementBankBalance(result.statementBalance, account, {
        destinationConfirmed: true
      });

      if (balancePlan.kind === 'set' && account) {
        try {
          await updateAccount(account.id, balancePlan.updates);
          bankBalance = {
            amount: formatCurrency(balancePlan.amount, account.currency),
            dateAsOf: formatStatementDay(balancePlan.dateAsOf)
          };
        } catch (error) {
          logger.error('Failed to set bank balance from OFX statement', error);
          bankBalanceError = `The transactions imported fine, but ${account.name}'s Bank Balance couldn't be updated — Reconciliation will still compare against the old figure. You can type it in there.`;
        }
      }

      setImportResult({
        success: true,
        imported: result.newTransactions,
        duplicates: result.duplicates,
        reviewedOut: result.duplicateMatches.possible.filter(
          match => match.fitId === null || !importAnywayFitIds.has(match.fitId)
        ).length,
        account,
        savedDetails,
        savedDetailsError,
        bankBalance,
        bankBalanceError
      });
    } catch (error) {
      logger.error('Import error', error);
      setImportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Import failed'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [accounts, addTransaction, file, importAnywayFitIds, parseResult, saveDetails, selectedAccountId, skipDuplicates, transactions, categories, updateAccount]);

  // Reset modal
  const resetModal = useCallback(() => {
    setFile(null);
    setParseResult(null);
    setImportResult(null);
    setSelectedAccountId('');
    setAccountIsUserChoice(false);
    setSaveDetailsOverride(null);
    setImportAnywayFitIds(new Set());
  }, []);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import OFX File" size="lg">
      <div className="p-6">
        {!parseResult && !importResult && (
          <>
            {/* File Upload */}
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Upload OFX File
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop your .ofx file here, or click to browse
              </p>
              <input
                type="file"
                accept=".ofx"
                onChange={handleFileUpload}
                className="hidden"
                id="ofx-upload"
              />
              <label
                htmlFor="ofx-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary cursor-pointer"
              >
                <FileTextIcon size={20} />
                Select OFX File
              </label>
            </div>
            
            {/* Info Box */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <InfoIcon className="text-blue-700 dark:text-blue-400 mt-0.5" size={20} />
                <div className="text-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    About OFX Files
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200 mb-2">
                    OFX (Open Financial Exchange) files contain standardized financial data exported from banks and credit card companies.
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                    {/* The old bullet promised detection "using transaction IDs",
                        and that is exactly all it did — so every row that arrived
                        from a bank feed, from Money or by hand, none of which
                        carry one, was imported a second time. */}
                    <li>• Finds transactions you already have, by the bank&apos;s own id or by date and amount</li>
                    <li>• Smart account matching based on account numbers</li>
                    <li>• Preserves transaction reference numbers</li>
                    <li>• Sets the account&apos;s Bank Balance from the statement&apos;s closing balance</li>
                    {/* Said plainly because it changed: rows used to arrive
                        pre-cleared, which skipped the check the file is for. */}
                    <li>• Leaves the transactions for you to reconcile against the statement</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Parse Results */}
        {parseResult && !importResult && (
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <FileTextIcon className="text-gray-600 dark:text-gray-400" size={24} />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{file?.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {parseResult.statementRows.length} transactions found
                </p>
              </div>
            </div>
            
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import to Account
              </label>

              {parseResult.matchedAccount ? (
                <div className="p-4 mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <LinkIcon className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-300">
                        Automatically matched to: {parseResult.matchedAccount.name}
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                        {parseResult.matchConfidence === 'identifier'
                          ? `Its recorded bank details are the ones in this file (account ending ${fileLastFour}).`
                          : `A best guess from the account's name and type — nothing recorded on your accounts matches account ending ${fileLastFour}, so check this is right.`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                parseResult.ofxAccount && (
                  <div className="p-4 mb-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <UnlinkIcon className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                      <div>
                        <p className="font-medium text-yellow-900 dark:text-yellow-300">
                          No matching account found
                        </p>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                          OFX Account: ****{fileLastFour}
                          {fileSortCode && ` (Sort code: ${fileSortCode})`}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Always offered, even after an automatic match: the match can
                  be a guess, and a guess the user cannot overrule is a trap. */}
              <AccountSelector
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onAccountChange={handleAccountChange}
                placeholder="Search or select an account…"
                formatLabel={(account) => `${account.name} (${account.type})`}
                className="w-full px-3 py-2 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                usePortal
                required
                ariaLabel="Import to Account"
              />

              {/* Filling in blank bank details is an edit to the account, so it
                  is stated here before it happens rather than discovered in
                  the account's settings weeks later. */}
              {detailsToSave && selectedAccount && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={saveDetails}
                      onChange={(e) => setSaveDetailsOverride(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Save this file&apos;s {detailsToSave.summary} to {selectedAccount.name}
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                    {selectedAccount.name} has none recorded, so this file has to be
                    matched by hand every time. Saving them now means the next one
                    finds it on its own.
                    {!saveDetailsByDefault && ' Off by default because this account was a guess — confirm it is the right one first.'}
                  </p>
                </div>
              )}

              {/* The Bank Balance is what makes finalising a reconciliation
                  mean anything, so what this file does to it is said before it
                  happens rather than discovered on the reconciliation screen. */}
              {bankBalanceNotice && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {bankBalanceNotice}
                </p>
              )}
            </div>

            {/* Import Options */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Skip transactions you already have
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                Matches on the bank&apos;s own transaction id where both sides have
                one, and otherwise on the date and the exact amount in this
                account. Anything matched that way is listed below for you to
                confirm before it is left out.
              </p>
            </div>

            {/* Already held — the bank's own id says so, so this is a count
                rather than a list: there is nothing for anyone to decide. */}
            {skipDuplicates && alreadyImportedCount > 0 && selectedAccount && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {alreadyImportedCount === 1
                  ? `1 transaction in this file was already imported into ${selectedAccount.name} (same bank transaction id), so it will not be added again.`
                  : `${alreadyImportedCount} transactions in this file were already imported into ${selectedAccount.name} (same bank transaction id), so they will not be added again.`}
              </p>
            )}

            {/* The review list. Nothing here is deleted and nothing is decided
                without the user: these rows are simply left out unless ticked. */}
            {skipDuplicates && reviewRows.length > 0 && selectedAccount && (
              <fieldset className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <legend className="px-2 text-sm font-semibold text-yellow-900 dark:text-yellow-300">
                  {reviewRows.length === 1
                    ? '1 transaction looks like one you already have'
                    : `${reviewRows.length} transactions look like ones you already have`}
                </legend>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  Each of these matches a transaction already in {selectedAccount.name}
                  {' '}to the penny, on the same day. The wording differs because payees
                  get renamed and older rows were shortened by whatever imported them, so
                  the description is no guide. They will <strong>not</strong> be imported —
                  tick any that are genuinely a second, separate payment.
                </p>
                <ul className="space-y-2">
                  {reviewRows.map(({ incoming, match }) => (
                    <li key={match.fitId ?? `${match.incomingIndex}`}>
                      <label className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-800 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={match.fitId !== null && importAnywayFitIds.has(match.fitId)}
                          onChange={() => toggleImportAnyway(match.fitId)}
                          className="mt-1 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="flex-1 min-w-0 text-sm">
                          <span className="block font-medium text-gray-900 dark:text-white">
                            {formatShortDate(incoming.date instanceof Date ? incoming.date : new Date(String(incoming.date)))}
                            {' · '}
                            {incoming.description}
                            {' · '}
                            {formatCurrency(incoming.amount, selectedAccount.currency)}
                          </span>
                          <span className="block text-gray-600 dark:text-gray-400">
                            Already here as &ldquo;{match.heldDescription}&rdquo; on{' '}
                            {formatShortDate(match.heldDate)}
                            {match.heldCleared ? ', reconciled' : ''}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            Import anyway if this is a second, separate payment of the same amount.
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {parseResult.statementRows.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">In this file</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {willImport}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Will be imported</p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <LoadingButton
                isLoading={isProcessing}
                onClick={processImport}
                disabled={!selectedAccountId && !parseResult.matchedAccount}
                className="flex items-center gap-2 px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50"
              >
                <UploadIcon size={20} />
                Import Transactions
              </LoadingButton>
            </div>
          </div>
        )}
        
        {/* Import Results */}
        {importResult && (
          <div className="text-center">
            {importResult.success ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <CheckIcon size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Successful!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Imported {importResult.imported} transactions to {importResult.account?.name}
                </p>
                
                {importResult.duplicates > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
                    Left out {importResult.duplicates}{' '}
                    {importResult.duplicates === 1 ? 'transaction' : 'transactions'} this
                    account already had, so the statement period is not recorded twice.
                    {importResult.reviewedOut > 0 && (
                      ` ${importResult.reviewedOut} of those matched on date and amount rather than on the bank's own id — you can add any of them by hand if the wording made you doubt the match.`
                    )}
                  </p>
                )}

                {importResult.bankBalance && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Bank Balance set to {importResult.bankBalance.amount}, as at{' '}
                    {importResult.bankBalance.dateAsOf}. Reconciliation now has
                    something to check these transactions against.
                  </p>
                )}

                {importResult.bankBalanceError && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
                    {importResult.bankBalanceError}
                  </p>
                )}

                {/* An edit to an account is not something to leave someone to
                    find on their own months later. */}
                {importResult.savedDetails && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Also saved to {importResult.savedDetails.accountName}:{' '}
                    {importResult.savedDetails.summary}. The next file from this
                    account will match it without asking.
                  </p>
                )}

                {importResult.savedDetailsError && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-6">
                    {importResult.savedDetailsError}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                  <AlertCircleIcon size={32} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Import Failed
                </h3>
                <p className="text-red-600 dark:text-red-400 mb-6">
                  {importResult.error}
                </p>
              </>
            )}
            
            <div className="flex justify-center gap-3">
              <button
                onClick={resetModal}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <RefreshCwIcon size={20} />
                Import Another File
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
