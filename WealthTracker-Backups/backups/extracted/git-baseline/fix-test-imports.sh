#!/bin/bash

# Fix test imports from named to default exports

echo "Fixing test imports..."

# SplitTransactionModal
sed -i '' 's/import { SplitTransactionModal } from/import SplitTransactionModal from/' src/components/__tests__/SplitTransactionModal.test.tsx

# ErrorBoundary
sed -i '' 's/import { ErrorBoundary } from/import ErrorBoundary from/' src/components/__tests__/ErrorBoundary.test.tsx

# BulkTransactionEdit
sed -i '' 's/import { BulkTransactionEdit } from/import BulkTransactionEdit from/' src/components/__tests__/BulkTransactionEdit.test.tsx

# GlobalSearch
sed -i '' 's/import { GlobalSearch } from/import GlobalSearch from/' src/components/__tests__/GlobalSearch.test.tsx

# DataValidation
sed -i '' 's/import { DataValidation } from/import DataValidation from/' src/components/__tests__/DataValidation.test.tsx

# DuplicateDetection
sed -i '' 's/import { DuplicateDetection } from/import DuplicateDetection from/' src/components/__tests__/DuplicateDetection.test.tsx

# BudgetRollover
sed -i '' 's/import { BudgetRollover } from/import BudgetRollover from/' src/components/__tests__/BudgetRollover.test.tsx

# DashboardWidget
sed -i '' 's/import { DashboardWidget } from/import DashboardWidget from/' src/components/__tests__/DashboardWidget.test.tsx

# FinancialOverview
sed -i '' 's/import { FinancialOverview } from/import FinancialOverview from/' src/components/__tests__/FinancialOverview.test.tsx

# RecurringTransactionModal
sed -i '' 's/import { RecurringTransactionModal } from/import RecurringTransactionModal from/' src/components/__tests__/RecurringTransactionModal.test.tsx

# NotificationSettings
sed -i '' 's/import { NotificationSettings } from/import NotificationSettings from/' src/components/__tests__/NotificationSettings.test.tsx

# OfflineIndicator
sed -i '' 's/import { OfflineIndicator } from/import OfflineIndicator from/' src/components/__tests__/OfflineIndicator.test.tsx

# TaxReportGenerator
sed -i '' 's/import { TaxReportGenerator } from/import TaxReportGenerator from/' src/components/__tests__/TaxReportGenerator.test.tsx

# ReportExport
sed -i '' 's/import { ReportExport } from/import ReportExport from/' src/components/__tests__/ReportExport.test.tsx

# ExportModal
sed -i '' 's/import { ExportModal } from/import ExportModal from/' src/components/__tests__/ExportModal.test.tsx

# CSVImportWizard
sed -i '' 's/import { CSVImportWizard } from/import CSVImportWizard from/' src/components/__tests__/CSVImportWizard.test.tsx

# ImportDataModal
sed -i '' 's/import { ImportDataModal } from/import ImportDataModal from/' src/components/__tests__/ImportDataModal.test.tsx

# ImportProgress
sed -i '' 's/import { ImportProgress } from/import ImportProgress from/' src/components/__tests__/ImportProgress.test.tsx

# GoalModal
sed -i '' 's/import { GoalModal } from/import GoalModal from/' src/components/__tests__/GoalModal.test.tsx

# GoalProgress
sed -i '' 's/import { GoalProgress } from/import GoalProgress from/' src/components/__tests__/GoalProgress.test.tsx

# InvestmentsDashboard
sed -i '' 's/import { InvestmentsDashboard } from/import InvestmentsDashboard from/' src/components/__tests__/InvestmentsDashboard.test.tsx

# AccountReconciliationModal
sed -i '' 's/import { AccountReconciliationModal } from/import AccountReconciliationModal from/' src/components/__tests__/AccountReconciliationModal.test.tsx

# AccountSelectionModal
sed -i '' 's/import { AccountSelectionModal } from/import AccountSelectionModal from/' src/components/__tests__/AccountSelectionModal.test.tsx

echo "Import fixes completed!"