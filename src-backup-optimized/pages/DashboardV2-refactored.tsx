import { memo, lazy, Suspense } from 'react';
import PageWrapper from '../components/PageWrapper';
import { SkeletonCard } from '../components/loading/Skeleton';
import { DashboardHeader } from '../components/dashboard-v2/DashboardHeader';
import { WidgetGrid } from '../components/dashboard-v2/WidgetGrid';
import { useDashboardV2Page } from '../hooks/useDashboardV2Page';
import { useApp } from '../contexts/AppContextSupabase';

// Lazy load modals
const AddWidgetModal = lazy(() => import('../components/dashboard/AddWidgetModal'));
const ExportModal = lazy(() => import('../components/export/ExportModal'));
const LayoutTemplatesModal = lazy(() => import('../components/dashboard/LayoutTemplatesModal'));

/**
 * Refactored DashboardV2 component
 * Manages customizable widget-based dashboard with drag-and-drop layout
 */
const DashboardV2 = memo(function DashboardV2() {
  const { accounts, transactions, budgets, goals } = useApp();
  const {
    // State
    isLoading,
    isEditMode,
    layouts,
    widgets,
    selectedLayout,
    isRefreshing,
    showAddWidget,
    showExport,
    showTemplates,
    isDirty,
    firstName,
    
    // Configs
    breakpoints,
    cols,
    templates,
    
    // Handlers
    handleLayoutChange,
    toggleEditMode,
    addWidget,
    removeWidget,
    resetToDefault,
    applyTemplate,
    exportLayout,
    importLayout,
    handleRefresh,
    toggleModal,
    saveDashboardLayout,
    getWidgetData
  } = useDashboardV2Page();

  if (isLoading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} className="h-48" />
          ))}
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Dashboard">
      {/* Header with controls */}
      <DashboardHeader
        firstName={firstName}
        isEditMode={isEditMode}
        isRefreshing={isRefreshing}
        onToggleEditMode={toggleEditMode}
        onRefresh={handleRefresh}
        onAddWidget={() => toggleModal('showAddWidget', true)}
        onShowTemplates={() => toggleModal('showTemplates', true)}
        onExport={() => toggleModal('showExport', true)}
      />

      {/* Widget Grid */}
      {widgets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No widgets added yet. Click "Edit Layout" to start customizing your dashboard.
          </p>
          <button
            onClick={toggleEditMode}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Customizing
          </button>
        </div>
      ) : (
        <WidgetGrid
          widgets={widgets}
          layouts={layouts}
          isEditMode={isEditMode}
          breakpoints={breakpoints}
          cols={cols}
          onLayoutChange={handleLayoutChange}
          onRemoveWidget={removeWidget}
          getWidgetData={getWidgetData}
        />
      )}

      {/* Edit Mode Actions */}
      {isEditMode && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex items-center gap-3 z-50">
          <button
            onClick={resetToDefault}
            className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={() => importLayout}
            className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Import Layout
          </button>
          {isDirty && (
            <span className="text-sm text-orange-600 dark:text-orange-400">
              • Unsaved changes
            </span>
          )}
        </div>
      )}

      {/* Modals */}
      <Suspense fallback={null}>
        {showAddWidget && (
          <AddWidgetModal
            isOpen={showAddWidget}
            onClose={() => toggleModal('showAddWidget', false)}
            onAdd={addWidget}
            existingWidgets={widgets}
          />
        )}
        
        {showTemplates && (
          <LayoutTemplatesModal
            isOpen={showTemplates}
            onClose={() => toggleModal('showTemplates', false)}
            onSelect={applyTemplate}
          />
        )}
        
        {showExport && (
          <ExportModal
            isOpen={showExport}
            onClose={() => toggleModal('showExport', false)}
            accounts={accounts}
            transactions={transactions}
            budgets={budgets}
            goals={goals}
          />
        )}
      </Suspense>
    </PageWrapper>
  );
});

export default DashboardV2;