// Dynamic imports for heavy libraries
let jsPDFConstructor: typeof import('jspdf').jsPDF | null = null;
let html2canvas: typeof import('html2canvas').default | null = null;
import type { Transaction } from '../types';
import { logger } from '../services/loggingService';
import { formatPercentageValue } from '@wealthtracker/utils';
import { formatCurrency as formatCurrencyDecimal } from './currency-decimal';

interface ReportData {
  title: string;
  dateRange: string;
  summary: {
    income: number;
    expenses: number;
    netIncome: number;
    savingsRate: number;
  };
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  topTransactions: Transaction[];
  chartElements?: HTMLElement[];
}

export async function generatePDFReport(data: ReportData): Promise<void> {
  // Load libraries dynamically
  if (!jsPDFConstructor) {
    const module = await import('jspdf');
    jsPDFConstructor = module.jsPDF ?? module.default;
  }
  if (!html2canvas) {
    const module = await import('html2canvas');
    html2canvas = module.default;
  }
  
  const pdf = new jsPDFConstructor('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredHeight: number): boolean => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Title
  pdf.setFontSize(24);
  pdf.setTextColor(33, 150, 243); // Primary blue color
  pdf.text(data.title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Date range
  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text(data.dateRange, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Summary Section
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Financial Summary', margin, yPosition);
  yPosition += 10;

  // Summary boxes
  const boxWidth = (pageWidth - 2 * margin - 15) / 4;
  const boxHeight = 20;
  const boxY = yPosition;

  // Income box
  pdf.setFillColor(236, 253, 245); // Light green
  pdf.rect(margin, boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Income', margin + 2, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(34, 197, 94); // Green
  pdf.text(formatCurrencyDecimal(data.summary.income), margin + 2, boxY + 13);

  // Expenses box
  pdf.setFillColor(254, 242, 242); // Light red
  pdf.rect(margin + boxWidth + 5, boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Expenses', margin + boxWidth + 7, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(239, 68, 68); // Red
  pdf.text(formatCurrencyDecimal(data.summary.expenses), margin + boxWidth + 7, boxY + 13);

  // Net Income box
  const netIncomeColor = data.summary.netIncome >= 0 ? [236, 253, 245] as const : [254, 242, 242] as const;
  const netIncomeTextColor = data.summary.netIncome >= 0 ? [34, 197, 94] as const : [239, 68, 68] as const;
  pdf.setFillColor(netIncomeColor[0], netIncomeColor[1], netIncomeColor[2]);
  pdf.rect(margin + 2 * (boxWidth + 5), boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Net Income', margin + 2 * (boxWidth + 5) + 2, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(netIncomeTextColor[0], netIncomeTextColor[1], netIncomeTextColor[2]);
  pdf.text(formatCurrencyDecimal(data.summary.netIncome), margin + 2 * (boxWidth + 5) + 2, boxY + 13);

  // Savings Rate box
  pdf.setFillColor(254, 249, 195); // Light yellow
  pdf.rect(margin + 3 * (boxWidth + 5), boxY, boxWidth, boxHeight, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Savings Rate', margin + 3 * (boxWidth + 5) + 2, boxY + 5);
  pdf.setFontSize(14);
  pdf.setTextColor(245, 158, 11); // Yellow
  pdf.text(formatPercentageValue(data.summary.savingsRate, 1), margin + 3 * (boxWidth + 5) + 2, boxY + 13);

  yPosition += boxHeight + 15;

  // Charts (if provided)
  if (data.chartElements && data.chartElements.length > 0) {
    checkPageBreak(100);
    
    for (const chartElement of data.chartElements) {
      try {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        checkPageBreak(imgHeight);
        pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (error) {
        logger.error('Error capturing chart:', error);
      }
    }
  }

  // Category Breakdown Table
  checkPageBreak(60);
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Expense Categories', margin, yPosition);
  yPosition += 10;

  // Table header
  pdf.setFontSize(10);
  pdf.setFillColor(243, 244, 246);
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
  pdf.setTextColor(75, 85, 99);
  pdf.text('Category', margin + 2, yPosition + 5);
  pdf.text('Amount', margin + 80, yPosition + 5);
  pdf.text('Percentage', margin + 130, yPosition + 5);
  yPosition += 10;

  // Table rows
  pdf.setTextColor(0, 0, 0);
  data.categoryBreakdown.forEach((category, index) => {
    if (checkPageBreak(8)) {
      // Redraw header on new page
      pdf.setFontSize(10);
      pdf.setFillColor(243, 244, 246);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
      pdf.setTextColor(75, 85, 99);
      pdf.text('Category', margin + 2, yPosition + 5);
      pdf.text('Amount', margin + 80, yPosition + 5);
      pdf.text('Percentage', margin + 130, yPosition + 5);
      yPosition += 10;
      pdf.setTextColor(0, 0, 0);
    }

    if (index % 2 === 0) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
    }
    
    pdf.text(category.category, margin + 2, yPosition);
    pdf.text(formatCurrencyDecimal(category.amount), margin + 80, yPosition);
    pdf.text(formatPercentageValue(category.percentage, 1), margin + 130, yPosition);
    yPosition += 8;
  });

  yPosition += 10;

  // Top Transactions
  checkPageBreak(60);
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Top Transactions', margin, yPosition);
  yPosition += 10;

  // Transaction table header
  pdf.setFontSize(10);
  pdf.setFillColor(243, 244, 246);
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
  pdf.setTextColor(75, 85, 99);
  pdf.text('Date', margin + 2, yPosition + 5);
  pdf.text('Description', margin + 25, yPosition + 5);
  pdf.text('Category', margin + 100, yPosition + 5);
  pdf.text('Amount', margin + 140, yPosition + 5);
  yPosition += 10;

  // Transaction rows
  pdf.setTextColor(0, 0, 0);
  data.topTransactions.slice(0, 10).forEach((transaction, index) => {
    if (checkPageBreak(8)) {
      // Redraw header on new page
      pdf.setFontSize(10);
      pdf.setFillColor(243, 244, 246);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
      pdf.setTextColor(75, 85, 99);
      pdf.text('Date', margin + 2, yPosition + 5);
      pdf.text('Description', margin + 25, yPosition + 5);
      pdf.text('Category', margin + 100, yPosition + 5);
      pdf.text('Amount', margin + 140, yPosition + 5);
      yPosition += 10;
      pdf.setTextColor(0, 0, 0);
    }

    if (index % 2 === 0) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
    }
    
    pdf.setFontSize(9);
    pdf.text(new Date(transaction.date).toLocaleDateString('en-GB'), margin + 2, yPosition);
    
    // Truncate description if too long
    const maxDescLength = 30;
    const description = transaction.description.length > maxDescLength 
      ? transaction.description.substring(0, maxDescLength) + '...'
      : transaction.description;
    pdf.text(description, margin + 25, yPosition);
    
    pdf.text(transaction.category, margin + 100, yPosition);
    
    const amountColor = transaction.type === 'income' ? [34, 197, 94] as const : [239, 68, 68] as const;
    pdf.setTextColor(amountColor[0], amountColor[1], amountColor[2]);
    const amountText = `${transaction.type === 'income' ? '+' : '-'}${formatCurrencyDecimal(Math.abs(transaction.amount))}`;
    pdf.text(amountText, margin + 140, yPosition);
    pdf.setTextColor(0, 0, 0);
    
    yPosition += 8;
  });

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  const footerText = `Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`;
  pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save the PDF
  const filename = `financial-report-${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
}

// Function to generate a simple PDF without charts (faster)
export function generateSimplePDFReport(data: ReportData): void {
  const reportData = {
    ...data,
    chartElements: []
  };
  void generatePDFReport(reportData);
}
