/**
 * Dynamic XLSX loader for Excel export functionality
 * Prevents xlsx library from being bundled until actually needed
 * This saves ~488KB from the main bundle
 */

let xlsxModule: any = null;
let loadingPromise: Promise<any> | null = null;

/**
 * Dynamically loads the xlsx library when needed
 * Uses runtime import() to prevent build-time bundling
 */
async function loadXLSX() {
  if (xlsxModule) {
    return xlsxModule;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = import('xlsx').then(module => {
    xlsxModule = module;
    return module;
  }).catch(error => {
    loadingPromise = null;
    throw new Error(`Failed to load Excel export library: ${error.message}`);
  });

  return loadingPromise;
}

/**
 * Export data to Excel file
 * Dynamically loads xlsx library on first use
 */
export async function exportToExcel(
  data: any[],
  filename: string = 'export.xlsx',
  sheetName: string = 'Sheet1'
): Promise<void> {
  const XLSX = await loadXLSX();

  // Create workbook and worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate and download file
  XLSX.writeFile(wb, filename);
}

/**
 * Export multiple sheets to Excel file
 */
export async function exportMultipleSheets(
  sheets: Array<{ data: any[], name: string }>,
  filename: string = 'export.xlsx'
): Promise<void> {
  const XLSX = await loadXLSX();

  const wb = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  XLSX.writeFile(wb, filename);
}

/**
 * Create Excel workbook from data (for advanced customization)
 */
export async function createWorkbook(data: any[], sheetName: string = 'Sheet1') {
  const XLSX = await loadXLSX();

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return { workbook: wb, XLSX };
}

/**
 * Read Excel file (for imports)
 */
export async function readExcelFile(file: File): Promise<any[]> {
  const XLSX = await loadXLSX();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

/**
 * Check if XLSX is already loaded (for performance optimization)
 */
export function isXLSXLoaded(): boolean {
  return xlsxModule !== null;
}

/**
 * Preload XLSX library (optional - for eager loading)
 */
export function preloadXLSX(): Promise<void> {
  return loadXLSX().then(() => undefined);
}