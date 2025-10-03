import React, { useState, useEffect, memo } from 'react';
import { Modal, ModalBody, ModalFooter } from '../common/Modal';
import { EditIcon, DeleteIcon, PlusIcon, InfoIcon } from '../icons';
import { portfolioRebalanceService } from '../../services/portfolioRebalanceService';
import type { PortfolioTarget } from '../../services/portfolioRebalanceService';
import { useLogger } from '../services/ServiceProvider';

interface TargetManagementModalProps {
  targets: PortfolioTarget[];
  editingTarget: PortfolioTarget | null;
  onSave: (target: Partial<PortfolioTarget>) => void;
  onDelete: (targetId: string) => void;
  onSetActive: (target: PortfolioTarget) => void;
  onUseTemplate: (template: PortfolioTarget) => void;
  onClose: () => void;
}

export const TargetManagementModal = memo(function TargetManagementModal({ targets,
  editingTarget,
  onSave,
  onDelete,
  onSetActive,
  onUseTemplate,
  onClose
 }: TargetManagementModalProps): React.JSX.Element {
  const logger = useLogger();
  // Component initialization logging
  useEffect(() => {
    logger.info('TargetManagementModal component initialized', {
      componentName: 'TargetManagementModal'
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'targets' | 'templates' | 'edit'>('targets');
  const [formData, setFormData] = useState<Partial<PortfolioTarget>>(
    editingTarget || {
      name: '',
      description: '',
      allocations: [],
      rebalanceThreshold: 5
    }
  );

  useEffect(() => {
    if (editingTarget) {
      setFormData(editingTarget);
      setActiveTab('edit');
    }
  }, [editingTarget]);

  const templates = portfolioRebalanceService.getPortfolioTemplates();

  const handleAddAllocation = () => {
    setFormData({
      ...formData,
      allocations: [
        ...(formData.allocations || []),
        { assetClass: '', targetPercent: 0 }
      ]
    });
  };

  const handleUpdateAllocation = (index: number, field: string, value: string | number) => {
    const allocations = [...(formData.allocations || [])];
    allocations[index] = { ...allocations[index], [field]: value };
    setFormData({ ...formData, allocations });
  };

  const handleRemoveAllocation = (index: number) => {
    const allocations = [...(formData.allocations || [])];
    allocations.splice(index, 1);
    setFormData({ ...formData, allocations });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate allocations sum to 100%
    const total = formData.allocations?.reduce((sum, a) => sum + a.targetPercent, 0) || 0;
    if (Math.abs(total - 100) > 0.01) {
      alert('Target allocations must sum to 100%');
      return;
    }
    
    onSave(formData);
  };

  return (
    <Modal isOpen onClose={onClose} title="Portfolio Targets" size="lg">
      <ModalBody>
        <div className="flex gap-4 mb-6 border-b dark:border-gray-700">
          <button
            onClick={() => setActiveTab('targets')}
            className={`pb-2 px-1 ${activeTab === 'targets' ? 'border-b-2 border-gray-600 text-gray-600' : 'text-gray-600 dark:text-gray-400'}`}
          >
            My Targets
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-2 px-1 ${activeTab === 'templates' ? 'border-b-2 border-gray-600 text-gray-600' : 'text-gray-600 dark:text-gray-400'}`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`pb-2 px-1 ${activeTab === 'edit' ? 'border-b-2 border-gray-600 text-gray-600' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {editingTarget ? 'Edit' : 'Create'} Target
          </button>
        </div>

        {activeTab === 'targets' && (
          <div className="space-y-4">
            {targets.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No portfolio targets created yet</p>
            ) : (
              targets.map(target => (
                <div key={target.id} className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{target.name}</h4>
                        {target.isActive && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      {target.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{target.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        {target.allocations.map(alloc => (
                          <span key={alloc.assetClass}>
                            {alloc.assetClass}: {alloc.targetPercent}%
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!target.isActive && (
                        <button
                          onClick={() => onSetActive(target)}
                          className="text-sm text-gray-600 hover:text-blue-700"
                        >
                          Set Active
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setFormData(target);
                          setActiveTab('edit');
                        }}
                        className="p-1 text-gray-600 hover:text-gray-900"
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(target.id)}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <DeleteIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-4">
            {templates.map(template => (
              <div key={template.id} className="border dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      {template.allocations.map(alloc => (
                        <span key={alloc.assetClass}>
                          {alloc.assetClass}: {alloc.targetPercent}%
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => onUseTemplate(template)}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'edit' && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Rebalance Threshold (%)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.rebalanceThreshold || 5}
                  onChange={(e) => setFormData({ ...formData, rebalanceThreshold: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Rebalancing will be recommended when any allocation deviates by this percentage
                </p>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Target Allocations</label>
                  <button
                    type="button"
                    onClick={handleAddAllocation}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700"
                  >
                    <PlusIcon size={16} />
                    Add Asset Class
                  </button>
                </div>
                
                <div className="space-y-2">
                  {formData.allocations?.map((alloc, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={alloc.assetClass}
                        onChange={(e) => handleUpdateAllocation(index, 'assetClass', e.target.value)}
                        placeholder="Asset Class"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={alloc.targetPercent}
                        onChange={(e) => handleUpdateAllocation(index, 'targetPercent', parseFloat(e.target.value))}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        required
                      />
                      <span className="text-sm">%</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAllocation(index)}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <DeleteIcon size={16} />
                      </button>
                    </div>
                  )) || []}
                </div>
                
                {formData.allocations && formData.allocations.length > 0 && (
                  <p className={`text-sm mt-2 ${
                    Math.abs((formData.allocations.reduce((sum, a) => sum + a.targetPercent, 0)) - 100) < 0.01
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    Total: {formData.allocations.reduce((sum, a) => sum + a.targetPercent, 0).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </form>
        )}
      </ModalBody>
      
      {activeTab === 'edit' && (
        <ModalFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            {editingTarget ? 'Update' : 'Create'} Target
          </button>
        </ModalFooter>
      )}
    </Modal>
  );
});