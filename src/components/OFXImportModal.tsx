import React, { useState, useCallback, useMemo } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { ofxImportService } from '../services/ofxImportService';
import {
  planAccountDetailsBackfill,
  readOfxAccountIdentifiers
} from '../utils/ofxAccountIdentifiers';
import { keepLastFour } from '../utils/accountNumberInput';
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

type ImportOutcome =
  | {
      success: true;
      imported: number;
      duplicates: number;
      account: Account | null;
      /** Set when the import also filled in the account's blank bank details. */
      savedDetails?: { accountName: string; summary: string };
      /** Set when saving those details failed — the transactions still landed. */
      savedDetailsError?: string;
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

  // Automatic when the destination is a decision (the user picked it, or the
  // account's own recorded details are the file's), off when it is a guess.
  const saveDetailsByDefault = accountIsUserChoice || matchIsCertain;
  const saveDetails = detailsToSave !== null && (saveDetailsOverride ?? saveDetailsByDefault);

  const handleAccountChange = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    setAccountIsUserChoice(true);
    setSaveDetailsOverride(null);
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
          autoCategorize: true
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

      setImportResult({
        success: true,
        imported: result.newTransactions,
        duplicates: result.duplicates,
        account,
        savedDetails,
        savedDetailsError
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
  }, [accounts, addTransaction, file, parseResult, saveDetails, selectedAccountId, skipDuplicates, transactions, categories, updateAccount]);

  // Reset modal
  const resetModal = useCallback(() => {
    setFile(null);
    setParseResult(null);
    setImportResult(null);
    setSelectedAccountId('');
    setAccountIsUserChoice(false);
    setSaveDetailsOverride(null);
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
                    <li>• Automatic duplicate detection using transaction IDs</li>
                    <li>• Smart account matching based on account numbers</li>
                    <li>• Preserves transaction reference numbers</li>
                    <li>• Imports cleared transactions with exact dates</li>
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
                  {parseResult.transactions.length} transactions found
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
                  Skip duplicate transactions
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                Uses unique transaction IDs to prevent importing the same transaction twice
              </p>
            </div>
            
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {parseResult.transactions.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {parseResult.duplicates || 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates Found</p>
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
                    Skipped {importResult.duplicates} duplicate transactions
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
