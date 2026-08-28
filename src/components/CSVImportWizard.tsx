import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import {
  enhancedCsvImportService,
  IMPORTABLE_TRANSACTION_FIELDS,
  type BankTemplate,
  type ColumnMapping,
  type ImportProfile,
  type ImportResult
} from '../services/enhancedCsvImportService';
import { dataPort, type BulkImportResult } from '@data';
import { summariseMissingRows, type MissingRowsSummary } from '../utils/partialImportSummary';
import { applyMappingPrefill } from '../utils/csvMappingPrefill';
import type { CsvRecord } from '../utils/csvTokenizer';
import {
  CSV_DATE_FORMATS,
  DATE_FORMAT_LABELS,
  DATE_FORMAT_NAMES,
  describeAs,
  inferDateFormat,
  resolveDateFormat,
  SUGGESTED_AMBIGUOUS_FORMAT,
  type CsvDateFormatChoice
} from '../utils/csvDateFormat';
import type { Account, Transaction } from '../types';
import {
  UploadIcon,
  FileTextIcon,
  CheckIcon,
  XIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SaveIcon,
  RefreshCwIcon
} from './icons';
import { LoadingButton } from './loading/LoadingState';
import { Modal } from './common/Modal';
import ImportProgress from './common/ImportProgress';
import CSVBankTemplates from './CSVBankTemplates';
import AccountSelector from './common/AccountSelector';
import ProfileNameDialog from './csvImport/ProfileNameDialog';
import DeleteProfileConfirm from './csvImport/DeleteProfileConfirm';
import { formatShortDate } from '../utils/dateFormatter';
import { formatCurrency } from '../utils/currency-decimal';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('CSVImportWizard');

/** How many of the file's rows the preview step shows. */
const PREVIEW_ROWS = 5;

/** How many example values are shown under a mapped column. */
const SAMPLE_VALUES = 3;

const previewHeadCell =
  'px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';

/**
 * What a required field is FOR, in the words of what goes wrong without it.
 *
 * The mapping step will not let a file past without all three, and a gate that
 * will not say why is the same dead button this wizard was full of.
 */
const REQUIRED_FIELD_REASONS: Record<string, string> = {
  date: 'a date column — without one, no row can be placed on a statement',
  description: 'a description column — without one, every row arrives with a blank payee',
  amount:
    'an amount column — or a pair of money-out and money-in columns — without one, every row arrives at £0.00'
};

/** What a template or a saved profile did when it met this file. */
interface PrefillReport {
  /** What was applied, named as the user chose it. */
  source: string;
  /** How many of its columns were found here. */
  appliedCount: number;
  /** Columns it names that this file does not have. */
  notInFile: string[];
  /** Columns whose destination this app does not import at all. */
  notImported: string[];
  /** Nothing matched, so the file's own headings were read instead. */
  fellBackToAutoDetect: boolean;
  /**
   * The date format it set, or null when it set none.
   *
   * Named because it is the one prefilled setting that can silently change what
   * gets WRITTEN rather than merely which column is read: a template saying
   * month-first over a day-first file transposes the first twelve days of every
   * month. A prefill that quiet has to be printed.
   */
  dateFormat: CsvDateFormatChoice | null;
}

/** Which profile dialog is open, if any. */
type ProfileDialog =
  | { kind: 'save' }
  | { kind: 'rename'; profile: ImportProfile }
  | { kind: 'delete'; profile: ImportProfile };

/**
 * ── THIS WIZARD IMPORTS TRANSACTIONS. THAT IS THE WHOLE LIST ─────────────────
 * There used to be a `type: 'transaction' | 'account'` prop. The account half
 * never existed: the import branch behind it was a `// TODO` that wrote
 * nothing, and latterly an out-loud refusal telling the user to go and make the
 * account by hand. Everything downstream of that prop — a second set of
 * suggested mappings, a second list of target fields, a second preview table
 * built from raw cells, a filter on the saved-profile list — existed to serve a
 * branch that could not do anything. Both call sites always passed
 * 'transaction'.
 */
interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * A file chosen somewhere else — the Batch Import queue hands this wizard the
   * next .csv on its list. Accepting one here is what lets that queue stay a
   * queue: it never parses or writes a row, because this wizard does all of it
   * exactly as it does for a file dropped below — including the column mapping
   * step, which is the whole reason a CSV cannot be imported unattended.
   */
  initialFile?: File;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'result';

/** A draft the file produced that names an account this user actually has. */
interface RoutedRow {
  accountId: string;
  draft: Omit<Transaction, 'id'>;
}

/**
 * What this import DID, as opposed to what the file offered.
 *
 * `parsed` is the service's own tally: rows it could read, rows it could not,
 * rows it left out as duplicates. `landed` is the only number that describes
 * the register — it comes back from the write, not from the parse. They used to
 * be the same number, which is how a file could report "412 imported" with
 * nothing at all in the account.
 */
interface WizardOutcome {
  parsed: ImportResult;
  landed: number;
  /** Rows a write refused, grouped by the account they were bound for. */
  missingByAccount: Array<{ accountName: string; summary: MissingRowsSummary }>;
  /** Rows that name no account this user has, so there is nowhere to file them. */
  unroutable: { count: number; names: string[]; noAccountColumn: boolean };
  /** The first write error, so the user has something to act on or quote. */
  reason?: string;
}

/**
 * Is this one of the transactions the file produced, rather than an account?
 *
 * `ImportResult.items` holds either, and only a transaction carries a `date` —
 * an Account has `lastUpdated`. Narrowing here rather than casting keeps the
 * field reads below type-checked.
 */
const isTransactionDraft = (
  item: Partial<Transaction> | Partial<Account>
): item is Partial<Transaction> =>
  'date' in item && 'amount' in item && 'description' in item && 'type' in item;

export default function CSVImportWizard({ isOpen, onClose, initialFile }: CSVImportWizardProps): React.JSX.Element {
  const {
    accounts,
    transactions,
    categories,
    refreshAccountsAndTransactions
  } = useApp();
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  /**
   * `lines[i]` is the PHYSICAL file line `data[i]` starts on.
   *
   * Carried alongside the rows rather than computed from their index, because
   * the two stopped being the same number the moment a quoted description could
   * contain a newline: a row on file line 40 might be the 37th row. Every
   * refusal printed on the preview step quotes one of these, and a person uses
   * it to find that row in a text editor.
   */
  const [lines, setLines] = useState<number[]>([]);
  /** Which physical line the column headings were read from. */
  const [headerLine, setHeaderLine] = useState(1);
  /** The records above the headings — a bank's covering block, shown greyed. */
  const [preamble, setPreamble] = useState<CsvRecord[]>([]);
  /**
   * The file's opening lines, as the heading-line picker offers them.
   *
   * Held from the SAME parse that produced the rows rather than recomputed:
   * reading the file a second time to fill a ten-line list would tokenize a
   * whole statement to show its first ten lines, and — worse — two parses can
   * disagree, which is how the picker would end up offering a line the mapping
   * step is not actually using.
   */
  const [headingCandidates, setHeadingCandidates] = useState<CsvRecord[]>([]);
  /** Why the headings were taken from where they were, when it was not line 1. */
  const [headerDetectedBecause, setHeaderDetectedBecause] = useState<string | null>(null);
  /** The heading line the USER chose, overriding detection. Null while detection stands. */
  const [headerLineChoice, setHeaderLineChoice] = useState<number | null>(null);
  /** Whether the "which line holds the headings" panel is open. */
  const [showHeaderPicker, setShowHeaderPicker] = useState(false);
  /**
   * Which way round this file's dates are read.
   *
   * 'auto' means "let the file decide", and it is honoured only where the file
   * CAN decide — a column containing any day past the 12th proves its own
   * order, and an ISO column proves itself. Where every date could be read two
   * ways, auto is not an answer and the gate below says so: guessing there is
   * exactly the bug this control exists to remove.
   */
  const [dateFormatChoice, setDateFormatChoice] = useState<CsvDateFormatChoice>('auto');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ImportProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<WizardOutcome | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [duplicateThreshold, setDuplicateThreshold] = useState(90);
  /** The file in hand. Null until one has been read AND understood. */
  const [fileName, setFileName] = useState<string | null>(null);
  /** Why the file that was offered is not the file in hand. */
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** The bank format chosen as a prefill — a set of column names, nothing more. */
  const [selectedTemplate, setSelectedTemplate] = useState<BankTemplate | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [prefillReport, setPrefillReport] = useState<PrefillReport | null>(null);
  /**
   * Held in state rather than read from the service during render: the list
   * changes under the user's hand now that profiles can be renamed and deleted,
   * and a render that re-reads a service is a list that updates by luck.
   */
  const [profiles, setProfiles] = useState<ImportProfile[]>(() =>
    enhancedCsvImportService.getProfiles()
  );
  /**
   * Saved profiles thrown away on load because they were for the account import
   * this app never performed. Read once, said once — see
   * consumeDiscardedProfileNotice.
   */
  const [discardedProfiles] = useState<string[]>(() =>
    enhancedCsvImportService.consumeDiscardedProfileNotice()
  );
  const [profileDialog, setProfileDialog] = useState<ProfileDialog | null>(null);
  /**
   * Where rows go when the FILE does not say.
   *
   * ── WHY THIS HAD TO EXIST ───────────────────────────────────────────────────
   * A bank statement names one account: its own, on the covering page, not in
   * the rows. So a normal export — Date, Description, Amount and nothing else —
   * gave every row `accountId: undefined`, every row was unroutable, and the
   * wizard finished with "Nothing was imported… no column is mapped to
   * accountName", telling the user to map a column their file does not have and
   * never will. The OFX and QIF dialogs have asked which account since the day
   * they shipped; this one asked for a column instead.
   *
   * It is a FALLBACK, not an override: a file that names an account this user
   * has still goes there (that is how one file can carry several accounts), and
   * a file that names an account this user does NOT have is still reported by
   * name rather than quietly redirected in here.
   */
  const [destinationAccountId, setDestinationAccountId] = useState('');
  /**
   * What the WRITE has confirmed so far, never what was hoped for. `total` is
   * set once every row has been routed to an account; `inserted` only ever
   * moves on a report from a writing path.
   */
  const [progress, setProgress] = useState<{ inserted: number; total: number } | null>(null);

  // An import awaits several writes and can settle after the wizard unmounts;
  // a setState then runs against a torn-down react-dom. Same pattern as the
  // QIF and OFX modals.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset wizard
  const resetWizard = () => {
    setCurrentStep('upload');
    setCsvContent('');
    setHeaders([]);
    setData([]);
    setLines([]);
    setHeaderLine(1);
    setPreamble([]);
    setHeadingCandidates([]);
    setHeaderDetectedBecause(null);
    setHeaderLineChoice(null);
    setShowHeaderPicker(false);
    setDateFormatChoice('auto');
    setMappings([]);
    setSelectedProfile(null);
    setImportResult(null);
    setImportError(null);
    setProgress(null);
    setFileName(null);
    setUploadError(null);
    setPrefillReport(null);
  };

  /**
   * Read a file and move to the mapping step. The one path into this wizard,
   * shared by the drop zone, the file input and the `initialFile` prop, so a
   * queued file gets the identical treatment to a hand-picked one.
   *
   * ── IT CAN REFUSE, AND SAYS SO WHERE THE FILE WAS CHOSEN ────────────────────
   * A file with no header row, or a header row and nothing else, used to be
   * accepted in silence and carried all the way to an empty preview and an
   * Import button offered over nothing. The step the user is standing on is the
   * one that has to say what is wrong with the thing they just handed over.
   */
  const acceptFile = useCallback((file: File) => {
    const reader = new FileReader();

    reader.onerror = () => {
      if (!isMountedRef.current) return;
      setUploadError(
        `${file.name} could not be read. Nothing has been imported — try choosing it again, or re-download it from your bank.`
      );
    };

    reader.onload = (e) => {
      if (!isMountedRef.current) return;
      const content = typeof e.target?.result === 'string' ? e.target.result : '';

      // parseCSV drops blank lines itself, so what is counted here is what the
      // import will count. The two used to be able to disagree.
      const parsed = enhancedCsvImportService.parseCSV(content);
      const rows = parsed.data;
      const namedColumns = parsed.headers.filter(header => header.trim() !== '');

      // A QUOTE THAT IS NEVER CLOSED IS NOT A NEAR-MISS. Everything from it to
      // the end of the file has been swallowed into one cell, so the rows below
      // are ABSENT rather than wrong — and a preview showing three rows of a
      // four-hundred-row statement, with no explanation, is how somebody
      // imports a quarter of their year and does not find out for months.
      if (parsed.unterminatedQuoteLine !== null) {
        setUploadError(
          `Line ${parsed.unterminatedQuoteLine} of ${file.name} opens a quotation mark that is never closed, so everything after it has been read as one long value. Nothing has been imported. Open the file, close or remove that quote, and try again.`
        );
        return;
      }
      if (namedColumns.length === 0) {
        setUploadError(
          `${file.name} has no column headings on its first line, so there is nothing to map its columns to. Nothing was imported.`
        );
        return;
      }
      if (rows.length === 0) {
        setUploadError(
          `${file.name} has column headings but no transactions under them, so there is nothing to import.`
        );
        return;
      }

      setCsvContent(content);
      setHeaders(parsed.headers);
      setData(rows);
      setLines(parsed.lines);
      setHeaderLine(parsed.headerLine);
      setPreamble(parsed.preamble);
      setHeadingCandidates(parsed.headingCandidates);
      setHeaderDetectedBecause(parsed.headerDetectedBecause);
      setHeaderLineChoice(null);
      // Opened by default only when detection actually skipped something: the
      // user is owed a sight of the lines being ignored, and nothing at all
      // when nothing is being ignored.
      setShowHeaderPicker(parsed.preamble.length > 0);
      setFileName(file.name);
      setUploadError(null);

      // A bank format chosen before the file arrived is applied now, against
      // this file's real headings — and reports what it could not find.
      if (selectedTemplate) {
        const prefill = applyMappingPrefill(selectedTemplate.mappings, parsed.headers);
        const fellBack = prefill.applied.length === 0;
        setMappings(
          fellBack
            ? enhancedCsvImportService.suggestMappings(parsed.headers)
            : prefill.applied
        );
        // A template that matched nothing has told us nothing about this file,
        // its date format included: prefilling one off a template that turned
        // out to be for another bank would be the confident half of a guess.
        setDateFormatChoice(fellBack ? 'auto' : selectedTemplate.dateFormat);
        setPrefillReport({
          source: selectedTemplate.label,
          appliedCount: prefill.applied.length,
          notInFile: prefill.notInFile,
          notImported: prefill.notImported,
          fellBackToAutoDetect: fellBack,
          dateFormat: fellBack ? null : selectedTemplate.dateFormat
        });
      } else {
        setMappings(enhancedCsvImportService.suggestMappings(parsed.headers));
        setDateFormatChoice('auto');
        setPrefillReport(null);
      }

      setCurrentStep('mapping');
    };

    reader.readAsText(file);
  }, [selectedTemplate]);

  /**
   * Compared by IDENTITY, not by name: re-rendering with the same File must not
   * re-read it and throw the user back to the mapping step, while a second file
   * that happens to share a name still gets read.
   */
  const loadedInitialFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (!initialFile || loadedInitialFileRef.current === initialFile) return;
    loadedInitialFileRef.current = initialFile;
    acceptFile(initialFile);
  }, [acceptFile, initialFile]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    acceptFile(file);
  }, [acceptFile]);

  /**
   * A dropped file.
   *
   * THE TYPE CHECK USED TO BE `file.type === 'text/csv'` AND NOTHING ELSE, so a
   * dropped file whose MIME type the browser reported as anything else — which
   * is most of them: Excel-touched CSVs arrive as
   * application/vnd.ms-excel, and plenty arrive as an empty string — vanished
   * on release with no message at all. The extension is what the user chose the
   * file by, so the extension is what is checked, and a wrong one is refused
   * out loud.
   */
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError(
        `${file.name} is not a .csv file, so it has not been read. Export a CSV from your bank, or use the OFX or QIF importer if that is what you have.`
      );
      return;
    }
    acceptFile(file);
  }, [acceptFile]);

  // Update mapping
  const updateMapping = (index: number, field: keyof ColumnMapping, value: string | ((value: string) => string | number | boolean | null)) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    // A TRANSFORM BELONGS TO THE PAIRING THAT CREATED IT. The suggester
    // attaches parseAmount to an amount mapping; when the person points that
    // column somewhere else (or points the mapping at another column), the
    // old closure must not ride along — the owner's "Debit or Credit"
    // column, corrected from amount to type, still ran parseAmount('DBIT')
    // and every row died with a DecimalError (28 Aug).
    if (field === 'targetField' || field === 'sourceColumn') {
      delete newMappings[index].transform;
    }
    setMappings(newMappings);
  };

  // Add new mapping
  const addMapping = () => {
    setMappings([...mappings, { sourceColumn: '', targetField: '' }]);
  };

  // Remove mapping
  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  /**
   * Apply a saved profile to THIS file.
   *
   * It used to be `setMappings(profile.mappings)` — the saved column names
   * installed wholesale, whether or not this file had any of them. A profile
   * saved against last month's bank, or against a different bank altogether,
   * half-applied in silence: the mapping list looked configured, the dropdowns
   * showed nothing (their values matched no column here), and the import
   * arrived with blank payees or £0.00 amounts. Same treatment as a template
   * now: what matched is applied, what did not is named.
   */
  const loadProfile = (profile: ImportProfile) => {
    setSelectedProfile(profile);
    setSelectedTemplate(null);
    const prefill = applyMappingPrefill(profile.mappings, headers);
    const fellBack = prefill.applied.length === 0;
    setMappings(
      fellBack ? enhancedCsvImportService.suggestMappings(headers) : prefill.applied
    );
    // Same reasoning as a template: a profile that matched no column of this
    // file is a profile for another file, and its date format is a claim about
    // that other file.
    const restoredFormat = fellBack ? 'auto' : profile.dateFormat ?? 'auto';
    setDateFormatChoice(restoredFormat);
    setPrefillReport({
      source: `Profile “${profile.name}”`,
      appliedCount: prefill.applied.length,
      notInFile: prefill.notInFile,
      notImported: prefill.notImported,
      fellBackToAutoDetect: fellBack,
      dateFormat: fellBack || profile.dateFormat === undefined ? null : profile.dateFormat
    });
    // The duplicate settings are part of the same saved decision — a profile
    // that restored only the columns restored half of what it promised.
    if (profile.skipDuplicates !== undefined) setShowDuplicates(profile.skipDuplicates);
    if (profile.duplicateThreshold !== undefined) setDuplicateThreshold(profile.duplicateThreshold);
  };

  /** Save the current columns, the date format AND the duplicate settings under a name. */
  const saveProfile = (name: string) => {
    const profile: ImportProfile = {
      id: `profile-${Date.now()}`,
      name,
      mappings,
      // Saved because it is part of the same decision as the columns: the bank
      // that calls a column 'Paid out' is the bank that writes 01/06/2026, and
      // a profile that remembered only the columns would ask the same question
      // again every month.
      dateFormat: dateFormatChoice,
      lastUsed: new Date(),
      skipDuplicates: showDuplicates,
      duplicateThreshold,
      ...(selectedTemplate ? { bank: selectedTemplate.id } : {})
    };

    enhancedCsvImportService.saveProfile(profile);
    setProfiles(enhancedCsvImportService.getProfiles());
    setSelectedProfile(profile);
    setProfileDialog(null);
  };

  const renameProfile = (profile: ImportProfile, name: string) => {
    enhancedCsvImportService.renameProfile(profile.id, name);
    const refreshed = enhancedCsvImportService.getProfiles();
    setProfiles(refreshed);
    // The id survives a rename, so the selection does too.
    setSelectedProfile(refreshed.find(entry => entry.id === profile.id) ?? null);
    setProfileDialog(null);
  };

  const deleteProfile = (profile: ImportProfile) => {
    enhancedCsvImportService.deleteProfile(profile.id);
    setProfiles(enhancedCsvImportService.getProfiles());
    // The columns it loaded STAY on screen: deleting the note of a mapping is
    // not the same as undoing the mapping, and silently clearing the user's
    // work would be a second, unasked-for change.
    setSelectedProfile(null);
    setProfileDialog(null);
  };

  /**
   * A bank format chosen from the list. It fills in column names — it does not
   * navigate, and it never used to be allowed to: selecting one used to jump
   * straight to Column Mapping with no file read, which is where the empty
   * dropdowns and the empty preview came from.
   */
  const selectTemplate = (template: BankTemplate) => {
    setSelectedTemplate(template);
    setSelectedProfile(null);
    if (headers.length === 0) {
      // No file yet: remembered, applied the moment one arrives.
      setPrefillReport(null);
      return;
    }
    const prefill = applyMappingPrefill(template.mappings, headers);
    const fellBack = prefill.applied.length === 0;
    setMappings(fellBack ? enhancedCsvImportService.suggestMappings(headers) : prefill.applied);
    setDateFormatChoice(fellBack ? 'auto' : template.dateFormat);
    setPrefillReport({
      source: template.label,
      appliedCount: prefill.applied.length,
      notInFile: prefill.notInFile,
      notImported: prefill.notImported,
      fellBackToAutoDetect: fellBack,
      dateFormat: fellBack ? null : template.dateFormat
    });
  };

  /**
   * Read the file again with the headings taken from a different line.
   *
   * The mappings are re-suggested rather than kept: the columns have just
   * changed identity, so a mapping pointing at "Account Name:" now points at
   * nothing. Keeping it would leave the step looking configured while importing
   * blanks — the exact failure the prefill report was built to stop.
   */
  const chooseHeaderLine = (line: number) => {
    const parsed = enhancedCsvImportService.parseCSV(csvContent, { headerLine: line });
    setHeaderLineChoice(line);
    setHeaders(parsed.headers);
    setData(parsed.data);
    setLines(parsed.lines);
    setHeaderLine(parsed.headerLine);
    setPreamble(parsed.preamble);
    setHeadingCandidates(parsed.headingCandidates);
    setHeaderDetectedBecause(null);
    setMappings(enhancedCsvImportService.suggestMappings(parsed.headers));
    setDateFormatChoice('auto');
    setPrefillReport(null);
    setSelectedProfile(null);
  };

  /**
   * What the FILE says about which way round its dates are.
   *
   * Recomputed when the date column's mapping moves, because the evidence lives
   * in that column and nowhere else: point the date mapping at a different
   * column and the question is a different question.
   */
  const dateSamples = useMemo(
    () => enhancedCsvImportService.dateColumnSamples(headers, data, mappings, lines),
    [headers, data, mappings, lines]
  );

  const dateEvidence = useMemo(() => inferDateFormat(dateSamples), [dateSamples]);

  /**
   * The format the rows will actually be read under — or NULL, which is the
   * gate: 'auto' over a file whose every date could be read two ways is not an
   * answer, and the old parser's willingness to pretend otherwise is what
   * transposed twelve days of every month.
   */
  const resolvedDateFormat = useMemo(
    () => resolveDateFormat(dateFormatChoice, dateEvidence),
    [dateFormatChoice, dateEvidence]
  );

  /**
   * When the user's explicit choice disagrees with something the file PROVES.
   *
   * Not a gate — an explicit choice is honoured, and the rows that cannot be
   * read under it refuse one by one with the format named. But a template
   * prefilled from a bank that has since changed its export, or a profile
   * loaded against the wrong month, would otherwise be obeyed in silence over
   * a file sitting right there disproving it.
   */
  const dateEvidenceContradiction = useMemo((): string | null => {
    if (dateFormatChoice === 'auto') return null;
    if (dateEvidence.outcome !== 'decided') return null;
    if (dateEvidence.format === dateFormatChoice) return null;
    return `${dateEvidence.because} These dates are set to be read as ${DATE_FORMAT_NAMES[dateFormatChoice]}.`;
  }, [dateFormatChoice, dateEvidence]);

  /**
   * The date control's own sentence: what is happening to these dates, in the
   * words of a real cell from the file.
   *
   * "Dates are read as DD/MM/YYYY (day first) — 01/06/2026 is 1 Jun 2026" is
   * the one line that lets somebody catch a transposed column in a second. A
   * format name on its own does not, because the two names look equally
   * plausible to anyone who has not just been bitten by them.
   */
  const dateFormatNote = useMemo((): { tone: 'plain' | 'warn'; text: string } | null => {
    if (dateSamples.length === 0) return null;

    if (resolvedDateFormat === null) {
      return {
        tone: 'warn',
        text:
          dateEvidence.outcome === 'conflicting'
            ? dateEvidence.because
            : `${dateEvidence.because} For a file from a UK bank the answer is normally ` +
              `${DATE_FORMAT_NAMES[SUGGESTED_AMBIGUOUS_FORMAT]} — but it has to be your answer, not ours.`
      };
    }

    // The worked example is read straight off the date column rather than out
    // of a built row: a row can be refused for reasons that have nothing to do
    // with its date, and this sentence is only about the date.
    const example = dateSamples.find(sample => sample.value.trim() !== '');
    const read = example === undefined ? null : describeAs(example.value, resolvedDateFormat);
    const worked = example === undefined || read === null ? '' : ` — ${example.value} is ${read}`;

    return {
      tone: 'plain',
      text:
        dateFormatChoice === 'auto'
          ? `${dateEvidence.because} Read as ${DATE_FORMAT_NAMES[resolvedDateFormat]}${worked}.`
          : `Read as ${DATE_FORMAT_NAMES[resolvedDateFormat]}${worked}.`
    };
  }, [dateSamples, resolvedDateFormat, dateEvidence, dateFormatChoice]);

  /**
   * Up to three real values from a column, so a mapping can be checked against
   * the file rather than against its own column heading. "Date → 06/01/2025"
   * is the one thing that catches a day/month mix-up before it is written.
   */
  const sampleValues = (sourceColumn: string): string[] => {
    const index = headers.indexOf(sourceColumn);
    if (index < 0) return [];
    const values: string[] = [];
    for (const row of data) {
      const value = row[index]?.trim();
      if (value) values.push(value);
      if (values.length === SAMPLE_VALUES) break;
    }
    return values;
  };

  // Process import
  const processImport = async () => {
    setIsProcessing(true);
    setImportError(null);

    // The gate has already refused to reach this step without one, so this
    // fallback is unreachable; it exists because the compiler cannot see the
    // gate, and inventing a cast to tell it so would be a lie in the type.
    const dateFormat = resolvedDateFormat ?? SUGGESTED_AMBIGUOUS_FORMAT;

    try {
      {
        // Create account map
        const accountMap = new Map(accounts.map(acc => [acc.name, acc.id]));

        const result = await enhancedCsvImportService.importTransactions(
          csvContent,
          mappings,
          transactions,
          accountMap,
          {
            skipDuplicates: showDuplicates,
            duplicateThreshold,
            // The transfer rule needs to know which register these rows are
            // joining — the file itself names no account.
            destinationAccountId,
            categories: categories || [],
            autoCategorize: true,
            categoryConfidenceThreshold: 0.7,
            // The SAME format the preview was built with, and the same heading
            // line. The preview and the write must read the file identically —
            // a preview that is right about a column the write reads
            // differently is worse than no preview.
            dateFormat,
            ...(headerLineChoice === null ? {} : { headerLine: headerLineChoice })
          }
        );

        // ── Route every drafted row to a real account ──────────────────────
        //
        // A CSV names its account in a column, so unlike an OFX statement one
        // file can carry several — and a row whose account name matches nothing
        // has nowhere to go. That case used to be handled by an `'accountId' in
        // item` test that skipped the row in silence while the success tile went
        // on counting it, so a file with no Account column mapped reported
        // hundreds imported and put nothing anywhere. Rows that cannot be filed
        // are collected and named instead.
        const accountsById = new Map(accounts.map(account => [account.id, account]));
        const routed: RoutedRow[] = [];
        const unroutableNames = new Set<string>();
        let unroutableCount = 0;
        let rowsWithoutAnyAccount = 0;

        for (const item of result.items) {
          if (!isTransactionDraft(item)) continue;

          const fromFile = typeof item.accountId === 'string' ? item.accountId : '';
          // The file's own account wins; the chosen destination catches the
          // rows it says nothing about. A row that NAMES an account this user
          // has not got is never redirected here — filing somebody's Barclays
          // rows into their Amex because a name was misspelt is a register that
          // disagrees with two banks at once.
          const namedButUnknown = typeof item.accountName === 'string' && item.accountName !== '';
          const accountId = accountsById.has(fromFile)
            ? fromFile
            : !namedButUnknown && accountsById.has(destinationAccountId)
              ? destinationAccountId
              : '';

          if (!accountsById.has(accountId)) {
            unroutableCount += 1;
            if (namedButUnknown) {
              unroutableNames.add(item.accountName ?? '');
            } else {
              rowsWithoutAnyAccount += 1;
            }
            continue;
          }

          routed.push({
            accountId,
            draft: {
              date: item.date instanceof Date ? item.date : new Date(String(item.date)),
              description: item.description ?? '',
              amount: item.amount ?? 0,
              type: item.type ?? 'expense',
              accountId,
              category: item.category ?? '',
              cleared: item.cleared ?? false,
              ...(item.notes !== undefined ? { notes: item.notes } : {}),
              ...(item.tags !== undefined ? { tags: item.tags } : {}),
              // Whether the category is the file's own word or the app's guess.
              // Set by the import service; carried rather than rebuilt, because
              // only the service knows which of the two it was.
              ...(item.categoryConfirmed !== undefined
                ? { categoryConfirmed: item.categoryConfirmed }
                : {})
            }
          });
        }

        // ── Write, one account at a time, each batch all-or-nothing ────────
        //
        // One call per account, through the seam: whichever store this app is
        // holding decides for itself how to make a batch atomic (one
        // `import_transactions_atomic` per chunk in the cloud, one IndexedDB
        // write covering the rows and the balance on a device) and answers with
        // the same shape either way. Awaited — the un-awaited per-row loop this
        // replaces fired every write at once and dropped every promise.
        //
        // A failing account does NOT stop the rest: these are separate accounts
        // with nothing to do with each other, and refusing to file the Barclays
        // rows because the Amex ones would not write helps nobody. Every miss is
        // named below, per account, so the file can be re-run against just those.
        const byAccount = new Map<string, Omit<Transaction, 'id'>[]>();
        for (const { accountId, draft } of routed) {
          const existing = byAccount.get(accountId);
          if (existing) existing.push(draft);
          else byAccount.set(accountId, [draft]);
        }

        let landed = 0;
        let reason: string | undefined;
        const missingByAccount: WizardOutcome['missingByAccount'] = [];

        // The size of the job, known now that every row has been routed to an
        // account and before a single one is written. Nothing is claimed as
        // inserted yet.
        const rowsToWrite = routed.length;
        if (isMountedRef.current && rowsToWrite > 0) {
          setProgress({ inserted: 0, total: rowsToWrite });
        }

        for (const [accountId, rows] of byAccount) {
          const account = accountsById.get(accountId);
          // A multi-account file writes one account at a time, so the count on
          // screen is what has landed ACROSS accounts so far — a store that
          // commits in chunks reports each one, a store whose write is a single
          // atomic transaction reports nothing until that account is done.
          const alreadyLanded = landed;
          const outcome: BulkImportResult = await dataPort.importTransactions(accountId, rows, {
            // Fires between chunks, so it can also land after unmount.
            onProgress: p => {
              if (isMountedRef.current) {
                setProgress({ inserted: alreadyLanded + p.inserted, total: rowsToWrite });
              }
            }
          });

          landed += outcome.inserted;
          if (isMountedRef.current && rowsToWrite > 0) {
            setProgress({ inserted: landed, total: rowsToWrite });
          }
          if (!outcome.complete) {
            missingByAccount.push({
              accountName: account?.name ?? 'this account',
              summary: summariseMissingRows(rows.slice(outcome.inserted), account?.currency ?? 'GBP')
            });
            reason = reason ?? outcome.error;
          }
        }

        // The store is the authority on what landed — read it back rather than
        // assuming the drafts made it.
        if (byAccount.size > 0) {
          await refreshAccountsAndTransactions();
        }

        if (!isMountedRef.current) return;
        setImportResult({
          parsed: result,
          landed,
          missingByAccount,
          unroutable: {
            count: unroutableCount,
            names: [...unroutableNames],
            noAccountColumn: rowsWithoutAnyAccount > 0
          },
          reason
        });
      }

      if (isMountedRef.current) {
        setCurrentStep('result');
      }
    } catch (error) {
      // This used to be a bare console.error, which left the wizard sitting on
      // the preview step with no message at all — indistinguishable from a
      // button that did nothing.
      logger.error('Import error', error);
      if (isMountedRef.current) {
        setImportError(error instanceof Error ? error.message : 'Import failed');
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setProgress(null);
      }
    }
  };

  /**
   * The fields a mapping can point at.
   *
   * 'balance' is NOT among them, and its absence is the point: a Transaction
   * has no balance field, so a column mapped to it was read out of the file,
   * carried through the parse and thrown away at the write — a dropdown entry
   * that did nothing, offered next to ones that do. A file's running-balance
   * column is now reported as not imported, where the user can see it, instead
   * of appearing to be handled.
   *
   * It is the service's own list rather than a copy of it: the copy here had
   * already drifted once, and a dropdown offering a field the import ignores is
   * the same dead control in a different shape.
   */
  const targetFields = IMPORTABLE_TRANSACTION_FIELDS;

  /** Which of date/description/amount this mapping still lacks. */
  const missingRequired = useMemo(
    () => enhancedCsvImportService.missingRequiredFields(mappings, headers),
    [mappings, headers]
  );

  /**
   * EVERY row of the file, built exactly as the import will build it.
   *
   * The whole file, not the five on screen: "3 of 412 rows will be skipped" is
   * a fact about the import, and it can only be known by trying all 412. It is
   * the number that decides whether the Import button should be offered at all.
   */
  const rowOutcomes = useMemo(() => {
    if (data.length === 0 || resolvedDateFormat === null) return null;
    return enhancedCsvImportService.buildRows(headers, data, mappings, resolvedDateFormat);
  }, [headers, data, mappings, resolvedDateFormat]);

  const importableCount = useMemo(
    () => (rowOutcomes ? rowOutcomes.filter(outcome => outcome.ok).length : 0),
    [rowOutcomes]
  );

  /**
   * The rows that will be left out, gathered by REASON rather than listed one
   * by one: forty rows failing for the same reason is one problem with the
   * mapping, and printing it forty times hides that.
   */
  const skippedByReason = useMemo(() => {
    if (!rowOutcomes) return [];
    const groups = new Map<string, number[]>();
    rowOutcomes.forEach((outcome, index) => {
      if (outcome.ok) return;
      // The row's own PHYSICAL line, counted by the tokenizer. It used to be
      // `index + 2` — a header assumed to be one line long, on a file assumed
      // to have no covering block and no multi-line field. All three of those
      // assumptions are things real bank exports break, and once one row spans
      // two lines every number after it is wrong by a growing amount, sending
      // the reader to the wrong row of their own file.
      const lineNumber = lines[index] ?? index + 2;
      const existing = groups.get(outcome.error);
      if (existing) existing.push(lineNumber);
      else groups.set(outcome.error, [lineNumber]);
    });
    return [...groups.entries()].map(([reason, refusedLines]) => ({ reason, lines: refusedLines }));
  }, [rowOutcomes, lines]);

  /**
   * The preview, built the way the import builds it.
   *
   * ── WHY NOT THE RAW CELLS ───────────────────────────────────────────────────
   * This table used to print `row[headers.indexOf(mapping.sourceColumn)]` per
   * target field. For the many UK banks that ship SEPARATE Debit and Credit
   * columns, both mapped to `amount`, that showed the FIRST mapping's cell and
   * nothing else — so every credit row (empty Debit cell) previewed blank while
   * the import wrote it correctly. The screen said one thing and the register
   * said another, on the exact rows people check hardest.
   *
   * `buildRows` wraps the SAME buildTransactionFromRow the import uses, so the
   * debit/credit resolution, the explicit type column, the date parsing and the
   * skipping of rows with no usable amount are all one implementation. What is
   * on screen is what will be written.
   *
   * ── WHY buildRows AND NOT generatePreview ───────────────────────────────────
   * generatePreview DROPS what it cannot build, so its output no longer lines up
   * with the file's rows and a skipped row simply vanishes from the preview —
   * which is how somebody spends an evening hunting for it in the register.
   * buildRows answers for every row IN ORDER, each one built or refused with its
   * reason, so a skipped row can be shown AS skipped and told apart from the
   * next one along.
   *
   * Accounts are not previewed this way: this builds transactions, and an
   * account import's fields (name, currency, institution) are the file's own
   * cells with nothing to resolve.
   */
  const previewRows = useMemo(() => {
    if (!rowOutcomes) return null;
    return data.slice(0, PREVIEW_ROWS).map((row, index) => {
      const outcome = rowOutcomes[index];
      return {
        row,
        built: outcome?.ok ? outcome.transaction : null,
        // The row builder's own words for why it refused this row, so the
        // preview says "Unreadable date" where the date is unreadable rather
        // than one generic apology for every kind of failure.
        skippedBecause: outcome && !outcome.ok ? outcome.error : null
      };
    });
  }, [data, rowOutcomes]);

  /** Which optional columns the file actually maps, so none is a column of dashes. */
  const previewShowsCategory = mappings.some(m => m.targetField === 'category');
  const previewShowsAccount = mappings.some(m => m.targetField === 'accountName');

  /**
   * The file's own date cell for a row.
   *
   * The one raw value the preview keeps, because it is the one the built value
   * can hide: 01/06/2025 is the 1st of June or the 6th of January depending on
   * a decision made inside the parser, and reading the built date alone can
   * never catch that. Every other column is shown as it will be written.
   */
  const sourceDateCell = (row: string[]): string => {
    const mapping = mappings.find(m => m.targetField === 'date');
    const index = mapping ? headers.indexOf(mapping.sourceColumn || '') : -1;
    return index >= 0 ? (row[index] ?? '') : '';
  };

  /**
   * WHY THE FORWARD BUTTON IS UNAVAILABLE, or null when it is available.
   *
   * ── ONE PLACE, BECAUSE THE OWNER'S WALK WENT STRAIGHT THROUGH THE GAPS ──────
   * The gate used to be `currentStep === 'mapping' && mappings.length === 0`,
   * and that was all of it. So: pressing Next on the Upload step with no file
   * was allowed (it was a no-op, which reads as a broken button); a bank
   * template applied one empty mapping and Next was allowed; "+ Add Mapping"
   * made an empty pair, `mappings.length` became 1, and Next was allowed all
   * the way to a preview of nothing and an Import button offered over zero
   * rows. Each step now states its own precondition, and the reason is printed
   * next to the button rather than left to be guessed at.
   */
  const blockedReason = useMemo((): string | null => {
    if (currentStep === 'upload') {
      if (data.length === 0) {
        return 'Choose a CSV file to continue — a bank format on its own has nothing to read.';
      }
      return null;
    }

    if (currentStep === 'mapping') {
      if (data.length === 0) {
        return 'There is no file to map. Go back and choose one.';
      }
      if (missingRequired.length > 0) {
        return `Still needed: ${missingRequired
          .map(field => REQUIRED_FIELD_REASONS[field] ?? field)
          .join('; ')}.`;
      }
      // ── THE ONE THE FILE CANNOT ANSWER FOR ITSELF ──────────────────────────
      //
      // A statement whose every date falls on the 1st to the 12th of a month
      // reads identically day-first and month-first, and the two readings put
      // the same transaction in different months. There is no evidence to be
      // had and no default that is safe, so the wizard stops and asks. This is
      // the whole point of the control: the old parser answered it by itself,
      // differently for different rows of the same column, and said nothing.
      if (resolvedDateFormat === null) {
        return dateEvidence.outcome === 'conflicting'
          ? `These dates cannot all be read the same way round. ${dateEvidence.because} Choose which way to read them.`
          : `These dates could be read two ways: ${dateEvidence.because} Choose the format below.`;
      }
      // A file with no account column of its own has to be told where it goes,
      // or every row of it is unfilable and the import writes nothing.
      if (
        destinationAccountId === '' &&
        !mappings.some(mapping => mapping.targetField === 'accountName')
      ) {
        return 'Choose the account these transactions belong to — this file does not name one.';
      }
      return null;
    }

    if (currentStep === 'preview') {
      if (importableCount === 0) {
        return 'There is nothing to import — no row in this file can be read with these columns.';
      }
      return null;
    }

    return null;
  }, [
    currentStep,
    data.length,
    missingRequired,
    importableCount,
    destinationAccountId,
    mappings,
    resolvedDateFormat,
    dateEvidence
  ]);

  /**
   * The currency to print a previewed amount in: the DESTINATION account's,
   * matching the write path and summariseMissingRows. These are the numbers
   * printed on the statement in front of the user, and converting them to a
   * display currency would make them unfindable. Falls back to the same 'GBP'
   * the write path falls back to when the file names no account.
   */
  const previewCurrency = (accountName: string | undefined): string =>
    accounts.find(account => account.name === accountName)?.currency ?? 'GBP';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CSV Import Wizard" size="xl">
      {/* h-[600px] is the PREFERRED height; min-h-0 lets flex shrink it when
          the Modal panel's max-height is smaller (a laptop with the window
          half-height), so the step content scrolls inside itself instead of
          the wizard's lower half being clipped off unreachable. */}
      <div className="flex flex-col h-[600px] min-h-0">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-4">
            <StepIndicator 
              label="Upload" 
              isActive={currentStep === 'upload'} 
              isComplete={['mapping', 'preview', 'result'].includes(currentStep)} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Map Columns" 
              isActive={currentStep === 'mapping'} 
              isComplete={['preview', 'result'].includes(currentStep)} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Preview" 
              isActive={currentStep === 'preview'} 
              isComplete={currentStep === 'result'} 
            />
            <ChevronRightIcon size={16} className="text-gray-400" />
            <StepIndicator 
              label="Import" 
              isActive={currentStep === 'result'} 
              isComplete={false} 
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* ── THE FILE FIRST ──────────────────────────────────────────────
              Not `justify-center h-full` any more. Centred content that
              overflows a scroll container overflows in BOTH directions, and the
              part above the scroll origin cannot be scrolled to — with forty
              bank buttons underneath it, that is exactly where the drop zone
              went. The owner of this app reported, correctly, that the CSV
              wizard offered no file picker at all: it was there, several
              hundred pixels above the top of the dialog, unreachable. A plain
              top-aligned column cannot do that. */}
          {currentStep === 'upload' && (
            <div className="p-6 space-y-6">
              <section>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Choose your CSV file
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  A statement or transaction export from your bank. The next step reads its column
                  headings, so you don&apos;t need to know its format in advance.
                </p>

                <div
                  className="w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center hover:border-primary transition-colors"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <UploadIcon size={48} className="mx-auto text-gray-400 mb-4" />
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    Upload CSV File
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Drag and drop your CSV file here, or click to browse
                  </p>
                  {/* sr-only, NOT hidden: display:none takes the input out of
                      the tab order entirely, and a <label> cannot hold focus in
                      its place — so the only way to reach this picker was a
                      mouse. Off-screen the input still takes focus, and
                      focus-within paints the ring on the button the user can
                      actually see. */}
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary cursor-pointer focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                    <FileTextIcon size={20} />
                    Select File
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="sr-only"
                      id="csv-upload"
                    />
                  </label>
                </div>

                {fileName && data.length > 0 && (
                  <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    Ready: <strong>{fileName}</strong> — {data.length}{' '}
                    {data.length === 1 ? 'row' : 'rows'}, {headers.length}{' '}
                    {headers.length === 1 ? 'column' : 'columns'}. Choosing another file replaces
                    it.
                  </p>
                )}

                {uploadError && (
                  <div
                    role="alert"
                    className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
                  >
                    <p className="text-sm text-amber-800 dark:text-amber-200">{uploadError}</p>
                  </div>
                )}
              </section>

              {/* ── THE TEMPLATE, SECOND AND OPTIONAL ────────────────────────
                  A template is a set of column names — a head start on the
                  mapping step, not a way in. It is collapsed because it was
                  the loudest thing in this dialog and the least important. */}
              <section className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTemplates(value => !value)}
                  aria-expanded={showTemplates}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-secondary transition-colors rounded"
                >
                  <ChevronRightIcon
                    size={16}
                    className={showTemplates ? 'rotate-90 transition-transform' : 'transition-transform'}
                  />
                  Know your bank&apos;s format? Fill in the columns for me (optional)
                </button>

                {selectedTemplate && (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {headers.length === 0 ? (
                      <>
                        <strong>{selectedTemplate.label}</strong> chosen. Its column names will be
                        filled in as soon as you choose a file — on their own they import nothing.
                      </>
                    ) : (
                      <>
                        <strong>{selectedTemplate.label}</strong> applied to {fileName}.
                      </>
                    )}
                  </p>
                )}

                {showTemplates && (
                  <div className="mt-3">
                    <CSVBankTemplates
                      selectedId={selectedTemplate?.id ?? null}
                      onSelectBank={selectTemplate}
                    />
                  </div>
                )}
              </section>
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Column Mapping
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {fileName
                    ? `Which column of ${fileName} holds what. Its own headings are listed below, with the first few values from each.`
                    : 'Map your CSV columns to the appropriate fields'}
                </p>
              </div>

              {/* ── WHICH LINE HOLDS THE HEADINGS ─────────────────────────────
                  Plenty of banks put a covering block above the table — the
                  account's name, its balance, the dates the download covers —
                  and reading line 1 as the headings then gives a file with no
                  date column and no amount column and a mapping step offering
                  the user nothing they can use.

                  What was detected is SHOWN, with the ignored lines printed
                  greyed, because this is a guess about somebody else's file:
                  a parser that silently skips three lines is indistinguishable
                  from one that has misread them. */}
              {data.length > 0 && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      Column headings read from <strong>line {headerLine}</strong>
                      {preamble.length > 0 ? (
                        <>
                          {' '}
                          — the {preamble.length === 1 ? 'line' : `${preamble.length} lines`} above{' '}
                          {preamble.length === 1 ? 'it is' : 'them are'} being ignored.
                        </>
                      ) : (
                        '.'
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowHeaderPicker(value => !value)}
                      aria-expanded={showHeaderPicker}
                      className="text-sm text-primary hover:text-secondary transition-colors rounded"
                    >
                      {showHeaderPicker ? 'Hide the file’s first lines' : 'Not right? Choose the heading line'}
                    </button>
                  </div>

                  {headerDetectedBecause && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {headerDetectedBecause}
                    </p>
                  )}

                  {showHeaderPicker && (
                    <ul className="mt-3 space-y-1" aria-label="The first lines of this file">
                      {headingCandidates.map(record => {
                        const isHeading = record.line === headerLine;
                        const isIgnored = record.line < headerLine;
                        const span =
                          record.lineSpan > 1
                            ? `${record.line}–${record.line + record.lineSpan - 1}`
                            : `${record.line}`;
                        return (
                          <li key={record.line} className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => chooseHeaderLine(record.line)}
                              disabled={isHeading}
                              aria-label={`Read the column headings from line ${record.line}`}
                              className="shrink-0 px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-primary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-100 disabled:cursor-default disabled:border-transparent disabled:text-gray-500 dark:disabled:text-gray-400"
                            >
                              {isHeading ? 'headings' : 'use this'}
                            </button>
                            <code
                              className={`text-xs break-all ${
                                isIgnored
                                  ? 'text-gray-400 dark:text-gray-500'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <span className="mr-2 tabular-nums">{span}</span>
                              {record.raw.trim()}
                              {isIgnored && (
                                <span className="ml-2 not-italic">(ignored)</span>
                              )}
                            </code>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* ── WHICH WAY ROUND THE DATES ARE ─────────────────────────────
                  01/06/2026 is the 1st of June or the 6th of January, and the
                  parser used to answer that differently for different rows of
                  the same column: anything past the 12th fell through to a
                  day-first branch, everything before it was caught by
                  JavaScript's month-first one. A UK statement therefore
                  imported with its first twelve days of every month transposed,
                  in silence.

                  Where the file settles the question, it settles it and says
                  how. Where it cannot, this control is required and the Next
                  button says so. */}
              {dateSamples.length > 0 && (
                <div className="mb-6">
                  <label
                    htmlFor="csv-date-format"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    How this file writes its dates
                  </label>
                  <select
                    id="csv-date-format"
                    value={dateFormatChoice}
                    onChange={e => {
                      const chosen = e.target.value;
                      setDateFormatChoice(
                        CSV_DATE_FORMATS.find(format => format === chosen) ?? 'auto'
                      );
                    }}
                    aria-describedby={dateFormatNote ? 'csv-date-format-note' : undefined}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {/* 'auto' stays the selected value until the user moves it,
                        even when the file is ambiguous and we can name the
                        likely answer. Preselecting that answer would BE the
                        guess: the confirmation is the safety, not the default. */}
                    <option value="auto">Work it out from the file</option>
                    {CSV_DATE_FORMATS.map(format => (
                      <option key={format} value={format}>
                        {DATE_FORMAT_LABELS[format]}
                      </option>
                    ))}
                  </select>
                  {dateFormatNote && (
                    <p
                      id="csv-date-format-note"
                      className={`mt-1 text-xs ${
                        dateFormatNote.tone === 'warn'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {dateFormatNote.text}
                    </p>
                  )}
                  {dateEvidenceContradiction && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Your file says otherwise: {dateEvidenceContradiction}
                    </p>
                  )}
                </div>
              )}

              {/* What a template or a profile actually did to this file —
                  including, and especially, what it could not find. */}
              {prefillReport && (
                <div
                  className={`mb-6 rounded-lg p-4 border ${
                    prefillReport.fellBackToAutoDetect || prefillReport.notInFile.length > 0
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {prefillReport.fellBackToAutoDetect ? (
                      <>
                        <strong>{prefillReport.source}</strong> names no column this file has, so
                        nothing was taken from it. The columns below were read out of your file
                        instead — check them and correct anything that is wrong.
                      </>
                    ) : (
                      <>
                        <strong>{prefillReport.source}</strong> filled in{' '}
                        {prefillReport.appliedCount}{' '}
                        {prefillReport.appliedCount === 1 ? 'column' : 'columns'}.
                      </>
                    )}
                  </p>
                  {prefillReport.notInFile.length > 0 && (
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                      Not found in your file: {prefillReport.notInFile.join(', ')} — nothing will be
                      imported from{' '}
                      {prefillReport.notInFile.length === 1 ? 'that column' : 'those columns'}.
                    </p>
                  )}
                  {prefillReport.notImported.length > 0 && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Not imported by this app: {prefillReport.notImported.join(', ')} — a running
                      balance or a share price has nowhere to go on a transaction.
                    </p>
                  )}
                  {prefillReport.dateFormat && prefillReport.dateFormat !== 'auto' && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      It also set the date format to{' '}
                      {DATE_FORMAT_NAMES[prefillReport.dateFormat]} — check that against your file
                      before importing.
                    </p>
                  )}
                </div>
              )}

              {/* ── Where these rows go ──────────────────────────────────────
                  Asked here because a bank statement does not say: it names its
                  account on the covering page, not in the rows. Without this,
                  every row of a normal export was unroutable and the wizard
                  ended by asking for a column the file has not got. */}
              <div className="mb-6">
                {/* A span, not a <label>: this combobox is a button, and its
                    accessible name is its own aria-label. The two are the
                    same words so that "click Import these transactions into"
                    names the thing a screen reader announces. */}
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Import these transactions into
                </span>
                <AccountSelector
                  accounts={accounts}
                  selectedAccountId={destinationAccountId}
                  onAccountChange={setDestinationAccountId}
                  placeholder="Search or select an account…"
                  formatLabel={(account: Account) => `${account.name} (${account.type})`}
                  className="w-full px-3 py-2 h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
                  usePortal
                  required
                  ariaLabel="Import these transactions into"
                />
                {mappings.some(m => m.targetField === 'accountName') && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Your file has an account column, so rows naming an account you have go
                    there. This is where the rest go.
                  </p>
                )}
              </div>

              {/* A saved profile that could never have worked, said once. See
                  loadProfiles: profiles marked for the account import were kept
                  in storage by a version that offered the feature and never
                  performed it, so they are dropped rather than coerced into
                  transaction profiles that would apply no columns at all. */}
              {discardedProfiles.length > 0 && (
                <div className="mb-6 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {discardedProfiles.length === 1
                      ? `The saved profile “${discardedProfiles[0]}” was for creating accounts from a CSV, which this app has never done — it could not have imported anything. It has been removed.`
                      : `${discardedProfiles.length} saved profiles (${discardedProfiles.join(', ')}) were for creating accounts from a CSV, which this app has never done — they could not have imported anything. They have been removed.`}{' '}
                    Your transaction profiles are untouched.
                  </p>
                </div>
              )}

              {/* Saved Profiles */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <label
                    htmlFor="csv-import-profile"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Import Profiles
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setProfileDialog({ kind: 'save' })}
                      disabled={mappings.length === 0}
                      title={mappings.length === 0 ? 'There are no columns to save yet' : undefined}
                      className="text-sm text-primary hover:text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <SaveIcon size={16} className="inline mr-1" />
                      Save Current
                    </button>
                    {/* Rename and Delete: the half of the life cycle that was
                        missing entirely, so a mis-saved profile stayed in the
                        list for good. Disabled WITH A REASON when nothing is
                        selected, rather than absent or inert. */}
                    <button
                      type="button"
                      onClick={() =>
                        selectedProfile && setProfileDialog({ kind: 'rename', profile: selectedProfile })
                      }
                      disabled={!selectedProfile}
                      title={selectedProfile ? undefined : 'Choose a saved profile to rename it'}
                      className="text-sm text-primary hover:text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectedProfile && setProfileDialog({ kind: 'delete', profile: selectedProfile })
                      }
                      disabled={!selectedProfile}
                      title={selectedProfile ? undefined : 'Choose a saved profile to delete it'}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <select
                  id="csv-import-profile"
                  value={selectedProfile?.id || ''}
                  onChange={(e) => {
                    const profile = profiles.find(p => p.id === e.target.value);
                    if (profile) loadProfile(profile);
                    else setSelectedProfile(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a saved profile...</option>
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mappings */}
              <div className="space-y-3">
                {mappings.map((mapping, index) => {
                  // A saved mapping can name a column this file has not got.
                  // The select would then show its FIRST option — silently
                  // rewriting the mapping to "nothing" on screen while the
                  // mapping itself still said otherwise. The column is listed
                  // as the missing thing it is instead.
                  const isMissingColumn =
                    mapping.sourceColumn !== '' && !headers.includes(mapping.sourceColumn);
                  const samples = sampleValues(mapping.sourceColumn);
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <select
                          aria-label={`CSV column for mapping ${index + 1}`}
                          value={mapping.sourceColumn}
                          onChange={(e) => updateMapping(index, 'sourceColumn', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Select CSV column...</option>
                          {headers.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                          {isMissingColumn && (
                            <option value={mapping.sourceColumn}>
                              {mapping.sourceColumn} — not in your file
                            </option>
                          )}
                        </select>
                        {/* The file's own values, so a mapping is checked
                            against the data and not against its heading. */}
                        {isMissingColumn ? (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            Your file has no column called “{mapping.sourceColumn}”, so this row
                            imports nothing.
                          </p>
                        ) : samples.length > 0 ? (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                            e.g. {samples.join(' · ')}
                          </p>
                        ) : mapping.sourceColumn ? (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Every value in this column is empty.
                          </p>
                        ) : null}
                      </div>

                      <span className="text-gray-500 pt-2">→</span>

                      <div className="flex-1 min-w-0">
                        <select
                          aria-label={`Target field for mapping ${index + 1}`}
                          value={mapping.targetField}
                          onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Select target field...</option>
                          {targetFields.map(field => (
                            <option key={field} value={field}>{field}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        aria-label={`Remove mapping ${index + 1}`}
                        onClick={() => removeMapping(index)}
                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <XIcon size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addMapping}
                disabled={headers.length === 0}
                title={
                  headers.length === 0
                    ? 'Choose a file first — a mapping needs columns to point at'
                    : undefined
                }
                className="mt-4 text-sm text-primary hover:text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Mapping
              </button>
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Preview Import
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review the first few rows to ensure correct mapping.
                  {/* True by construction, and worth saying (Design, 17 Aug
                      §6): the wizard parses with FileReader in this browser
                      and the service makes no network call — verified before
                      this sentence was written. Only accepted rows are saved
                      to the ledger. */}
                  {' '}Your file is read on this device and never uploaded —
                  only the rows you accept are saved to your ledger.
                </p>
              </div>

              {/* What this file will actually do, counted over ALL of it
                  before anything is written. The old preview showed five rows
                  and offered Import; how many of the other four hundred were
                  importable was not asked until afterwards. */}
              {rowOutcomes && (
                <div
                  className={`mb-6 rounded-lg p-4 border ${
                    importableCount === 0
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {importableCount === 0 ? (
                      <>
                        <strong>None of this file&apos;s {data.length} rows can be imported</strong>{' '}
                        with the columns as they are mapped. Go back to Map Columns and correct
                        them — nothing has been written.
                      </>
                    ) : (
                      <>
                        <strong>
                          {importableCount} of {data.length}{' '}
                          {data.length === 1 ? 'row' : 'rows'}
                        </strong>{' '}
                        will be imported.
                      </>
                    )}
                  </p>
                  {skippedByReason.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                      {skippedByReason.map(({ reason, lines }) => (
                        <li key={reason}>
                          {lines.length} {lines.length === 1 ? 'row' : 'rows'} skipped — {reason}{' '}
                          <span className="text-gray-600 dark:text-gray-400">
                            (line{lines.length === 1 ? '' : 's'}{' '}
                            {lines.slice(0, 5).join(', ')}
                            {lines.length > 5 ? `, and ${lines.length - 5} more` : ''})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Duplicate Detection Settings */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showDuplicates}
                      onChange={(e) => setShowDuplicates(e.target.checked)}
                      className="rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Skip duplicate transactions
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">
                      Threshold:
                    </label>
                    <input
                      type="number"
                      value={duplicateThreshold}
                      onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                      min="50"
                      max="100"
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <caption className="sr-only">
                    The first rows of the file as they will be written
                  </caption>
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className={previewHeadCell}>Date</th>
                      <th scope="col" className={previewHeadCell}>Description</th>
                      <th scope="col" className={`${previewHeadCell} text-right`}>Amount</th>
                      <th scope="col" className={previewHeadCell}>Type</th>
                      {previewShowsCategory && <th scope="col" className={previewHeadCell}>Category</th>}
                      {previewShowsAccount && <th scope="col" className={previewHeadCell}>Account</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                    {/* One table, built the way the import builds it. The raw-cell
                        fallback that used to sit here served the account-import
                        branch, which never wrote anything; it printed
                        `mapping.transform(cell)` per target field and so showed
                        the FIRST of a bank's two amount columns and nothing
                        else. */}
                    {(previewRows ?? []).map(({ row, built, skippedBecause }, rowIndex) => {
                          const columns = 4 + (previewShowsCategory ? 1 : 0) + (previewShowsAccount ? 1 : 0);
                          if (!built) {
                            // Shown rather than dropped, WITH the builder's own
                            // reason: silence here is how somebody spends an
                            // evening looking for a row in the register.
                            return (
                              <tr key={rowIndex}>
                                <td colSpan={columns} className="px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
                                  Will be skipped — {skippedBecause ?? 'this row has no usable amount'}
                                </td>
                              </tr>
                            );
                          }
                          const date = built.date instanceof Date ? built.date : new Date(String(built.date));
                          const shown = formatShortDate(date);
                          const source = sourceDateCell(row);
                          const amount = built.amount ?? 0;
                          return (
                            <tr key={rowIndex}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                {shown || <span className="text-amber-700 dark:text-amber-400">Unreadable date</span>}
                                {/* The file's own cell, when it does not read
                                    back identically — the one place a wrong
                                    day/month order can be spotted. */}
                                {source && source !== shown && (
                                  <span className="block text-xs text-gray-400 dark:text-gray-500">
                                    in the file: {source}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {built.description ?? ''}
                              </td>
                              <td
                                className={`px-4 py-2 text-sm text-right tabular-nums whitespace-nowrap ${
                                  amount < 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-green-700 dark:text-green-400'
                                }`}
                              >
                                {formatCurrency(amount, previewCurrency(built.accountName))}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                {built.type ?? ''}
                              </td>
                              {previewShowsCategory && (
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {built.category ?? ''}
                                </td>
                              )}
                              {previewShowsAccount && (
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {built.accountName ?? ''}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                These are the values that will be written — a bank&apos;s separate Debit and Credit
                columns have already been resolved into one signed amount.
              </p>

              {data.length > PREVIEW_ROWS && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Showing {PREVIEW_ROWS} of {data.length} rows
                </p>
              )}

              {/* The import threw before it could write anything. Previously
                  this was logged and nothing else, so pressing Import looked
                  like pressing a dead button. */}
              {importError && (
                <div
                  role="alert"
                  className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                >
                  <p className="text-sm text-red-800 dark:text-red-200">
                    Nothing was imported and nothing was changed — this file could
                    not be read far enough to write anything.
                  </p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    What went wrong: {importError}
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 'result' && importResult && (
            <div className="p-6">
              <div className="text-center mb-6">
                {/* "Complete" is a claim, so it is only made when the file
                    actually finished: nothing missing, nothing unfiled AND at
                    least one row in the register. A file that wrote nothing at
                    all used to report "Import Complete!" over a count of 0 —
                    the most confident lie in the wizard. */}
                {importResult.landed > 0 &&
                importResult.missingByAccount.length === 0 &&
                importResult.unroutable.count === 0 ? (
                  <>
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                      <CheckIcon size={32} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Import Complete!
                    </h3>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
                      <XIcon size={32} className="text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {importResult.landed === 0
                        ? 'Nothing was imported'
                        : 'Part of this file is missing'}
                    </h3>
                  </>
                )}
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  {/* What the WRITE confirmed. This tile used to show the
                      parser's tally, so a file that reached the database not at
                      all still read as a few hundred imported. */}
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {importResult.landed}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">Imported</p>
                </div>

                {/* "Skipped" said nothing about WHY. These rows were left out
                    on purpose, because the register already holds them. */}
                {importResult.parsed.duplicates > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                      {importResult.parsed.duplicates}
                    </p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      Skipped as duplicates
                    </p>
                  </div>
                )}

                {importResult.parsed.failed > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {importResult.parsed.failed}
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-300">Could not be read</p>
                  </div>
                )}
              </div>

              {/* Rows a write refused, named per account — the count alone
                  cannot be acted on, and the person reading this has the file
                  in front of them. */}
              {importResult.missingByAccount.map(({ accountName, summary }) => (
                <div
                  key={accountName}
                  className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
                >
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                    {summary.count === 1
                      ? `1 transaction never reached ${accountName}`
                      : `${summary.count} transactions never reached ${accountName}`}
                  </h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                    They are not in the register, so {accountName} will not agree
                    with the statement this file came from:
                  </p>
                  <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                    {summary.named.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                    {summary.hidden > 0 && (
                      <li className="text-gray-600 dark:text-gray-400">
                        …and {summary.hidden} more, from {summary.earliestDate} onwards.
                      </li>
                    )}
                  </ul>
                </div>
              ))}

              {/* Rows with nowhere to go. Previously skipped in silence while
                  the Imported tile counted them anyway. */}
              {importResult.unroutable.count > 0 && (
                <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                    {importResult.unroutable.count === 1
                      ? '1 transaction had no account to go into'
                      : `${importResult.unroutable.count} transactions had no account to go into`}
                  </h4>
                  {importResult.unroutable.names.length > 0 && (
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                      Their Account column names {importResult.unroutable.names.join(', ')}, and
                      you have no account of that name. Rename the account here to
                      match the file, or correct the file, then import it again —
                      nothing was written for these rows.
                    </p>
                  )}
                  {importResult.unroutable.noAccountColumn && (
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Nothing says which account these belong in. Go back to Map Columns and
                      choose one under <strong>Import these transactions into</strong> — or, if
                      the file names its own accounts in a column, map that column to{' '}
                      <strong>accountName</strong> — then import again.
                    </p>
                  )}
                </div>
              )}

              {importResult.reason && (
                <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                  What stopped it: {importResult.reason}
                </p>
              )}

              {/* Rows the parser could not read at all */}
              {importResult.parsed.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                    Rows that could not be read
                  </h4>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    {/* The file's own line numbers, so the row can be found in
                        the file rather than counted to. */}
                    {importResult.parsed.errors.slice(0, 5).map((error: { line: number; error: string }, index: number) => (
                      <li key={index}>
                        Line {error.line}: {error.error}
                      </li>
                    ))}
                    {importResult.parsed.errors.length > 5 && (
                      <li>... and {importResult.parsed.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions — during a write this row becomes the progress
            region, because it is the one part of the wizard that never
            scrolls out of sight. */}
        <div className="flex justify-between items-center gap-4 p-6 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={currentStep === 'upload' ? onClose : () => {
              const steps: WizardStep[] = ['upload', 'mapping', 'preview', 'result'];
              const currentIndex = steps.indexOf(currentStep);
              if (currentIndex > 0) {
                setCurrentStep(steps[currentIndex - 1]);
              }
            }}
            disabled={isProcessing}
            // Said, not just enforced: a dead button with no explanation is
            // indistinguishable from a broken one.
            title={isProcessing ? 'Import in progress' : undefined}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon size={20} />
            {currentStep === 'upload' ? 'Cancel' : 'Back'}
          </button>

          {/* No row count until the rows have been routed to accounts: how many
              a file will write is not known while duplicates are still being
              weighed, and a number here would be a guess presented as a fact. */}
          {isProcessing && (
            <div className="flex-1 min-w-0">
              <ImportProgress inserted={progress?.inserted ?? null} total={progress?.total ?? null} />
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* THE REASON, BESIDE THE BUTTON IT DISABLES.
                A greyed-out Next with nothing to explain it is the same dead
                control this wizard was made of — and the owner's walk started
                by pressing exactly this button with no file. Rendered as text
                as well as a title so it is readable without a mouse, and
                aria-describedby ties it to the button for a screen reader. */}
            {blockedReason && (
              <p
                id="csv-wizard-blocked-reason"
                className="text-sm text-amber-700 dark:text-amber-400 max-w-md text-right"
              >
                {blockedReason}
              </p>
            )}

            {currentStep === 'result' ? (
              <>
                <button
                  onClick={resetWizard}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <RefreshCwIcon size={20} />
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary"
                >
                  Done
                </button>
              </>
            ) : (
              <LoadingButton
                isLoading={isProcessing}
                loadingText="Importing…"
                onClick={() => {
                  if (currentStep === 'upload') {
                    setCurrentStep('mapping');
                  } else if (currentStep === 'mapping') {
                    setCurrentStep('preview');
                  } else if (currentStep === 'preview') {
                    processImport();
                  }
                }}
                title={blockedReason ?? undefined}
                aria-describedby={blockedReason ? 'csv-wizard-blocked-reason' : undefined}
                className="flex items-center gap-2 px-6 py-2 bg-[#1a2332] text-white rounded-lg hover:bg-secondary disabled:opacity-50"
                disabled={blockedReason !== null || isProcessing}
              >
                {currentStep === 'preview' ? (
                  <>
                    <UploadIcon size={20} />
                    Import
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRightIcon size={20} />
                  </>
                )}
              </LoadingButton>
            )}
          </div>
        </div>
      </div>

      {/* ── The profile life cycle, in the app's own dialogs ─────────────────
          Saving used to call window.prompt; deleting was not possible at all. */}
      {profileDialog?.kind === 'save' && (
        <ProfileNameDialog
          title="Save these columns"
          description="Next time you import a file from this bank, load this profile instead of mapping its columns again. The duplicate settings on the next step are saved with it."
          confirmLabel="Save profile"
          onConfirm={saveProfile}
          onCancel={() => setProfileDialog(null)}
        />
      )}
      {profileDialog?.kind === 'rename' && (
        <ProfileNameDialog
          title="Rename this profile"
          initialName={profileDialog.profile.name}
          description="Only the name changes. The columns it remembers stay exactly as they are."
          confirmLabel="Rename"
          onConfirm={name => renameProfile(profileDialog.profile, name)}
          onCancel={() => setProfileDialog(null)}
        />
      )}
      {profileDialog?.kind === 'delete' && (
        <DeleteProfileConfirm
          profileName={profileDialog.profile.name}
          onConfirm={() => deleteProfile(profileDialog.profile)}
          onCancel={() => setProfileDialog(null)}
        />
      )}
    </Modal>
  );
}

// Step Indicator Component
function StepIndicator({ 
  label, 
  isActive, 
  isComplete 
}: { 
  label: string; 
  isActive: boolean; 
  isComplete: boolean; 
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Animated ring for active step */}
        {isActive && (
          <div className="absolute inset-0 w-10 h-10 rounded-full bg-[#1a2332]/20 animate-ping" />
        )}
        <div
          className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
            isComplete
              ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
              : isActive
              ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30 scale-110'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          {isComplete ? (
            <CheckIcon size={20} className="animate-[bounce_0.5s_ease-in-out]" />
          ) : (
            <span className="font-semibold">{label.charAt(0)}</span>
          )}
        </div>
      </div>
      <span className={`text-xs mt-2 font-medium transition-colors duration-200 ${
        isComplete
          ? 'text-blue-600 dark:text-blue-400'
          : isActive 
          ? 'text-primary' 
          : 'text-gray-500 dark:text-gray-400'
      }`}>
        {label}
      </span>
    </div>
  );
}
