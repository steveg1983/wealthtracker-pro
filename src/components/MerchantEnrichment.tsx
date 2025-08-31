import React, { useState, useEffect } from 'react';
import { dataIntelligenceService } from '../services/dataIntelligenceService';
import type { MerchantData, MerchantEnrichment } from '../services/dataIntelligenceService';
import { logger } from '../services/loggingService';
import { 
  SearchIcon,
  TagIcon,
  BuildingIcon,
  StarIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  EditIcon,
  EyeIcon,
  TrendingUpIcon,
  BarChart3Icon,
  FilterIcon
} from './icons';

interface MerchantEnrichmentProps {
  onDataChange?: () => void;
}

export default function MerchantEnrichment({ onDataChange }: MerchantEnrichmentProps) {
  const [merchants, setMerchants] = useState<MerchantData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'confidence' | 'frequency' | 'lastUpdated'>('confidence');
  const [testEnrichment, setTestEnrichment] = useState('');
  const [enrichmentResult, setEnrichmentResult] = useState<MerchantEnrichment | null>(null);

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would come from the service
      // For now, we'll simulate merchant data
      const mockMerchants: MerchantData[] = [
        {
          id: '1',
          name: 'Amazon',
          cleanName: 'Amazon',
          category: 'Shopping',
          industry: 'E-commerce',
          frequency: 'monthly',
          tags: ['online', 'retail', 'marketplace'],
          confidence: 0.95,
          avgTransactionAmount: 45.99,
          createdAt: new Date('2024-01-01'),
          lastUpdated: new Date()
        },
        {
          id: '2',
          name: 'Netflix',
          cleanName: 'Netflix',
          category: 'Entertainment',
          industry: 'Streaming',
          frequency: 'monthly',
          tags: ['subscription', 'streaming', 'entertainment'],
          confidence: 0.98,
          avgTransactionAmount: 15.99,
          createdAt: new Date('2024-01-01'),
          lastUpdated: new Date()
        },
        {
          id: '3',
          name: 'Starbucks',
          cleanName: 'Starbucks',
          category: 'Food & Dining',
          industry: 'Coffee',
          frequency: 'daily',
          tags: ['coffee', 'food', 'chain'],
          confidence: 0.92,
          avgTransactionAmount: 5.85,
          createdAt: new Date('2024-01-01'),
          lastUpdated: new Date()
        }
      ];
      setMerchants(mockMerchants);
    } catch (error) {
      logger.error('Error loading merchants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEnrichment = () => {
    if (!testEnrichment.trim()) return;
    
    const result = dataIntelligenceService.enrichMerchant(testEnrichment);
    setEnrichmentResult(result);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
  };

  const categories = ['all', ...Array.from(new Set(merchants.map(m => m.category)))];

  const filteredMerchants = merchants
    .filter(merchant => {
      const matchesSearch = merchant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           merchant.cleanName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           merchant.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || merchant.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'confidence':
          return b.confidence - a.confidence;
        case 'frequency':
          return a.frequency.localeCompare(b.frequency);
        case 'lastUpdated':
          return b.lastUpdated.getTime() - a.lastUpdated.getTime();
        default:
          return 0;
      }
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCwIcon size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <SearchIcon size={20} className="text-blue-600 dark:text-blue-400" />
          Merchant Enrichment
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          View and manage merchant data enrichment and categorization
        </p>
      </div>

      {/* Test Enrichment */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Test Merchant Enrichment</h4>
        <div className="flex gap-3">
          <input
            type="text"
            value={testEnrichment}
            onChange={(e) => setTestEnrichment(e.target.value)}
            placeholder="Enter merchant name or transaction description..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleTestEnrichment}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
          >
            Test
          </button>
        </div>
        
        {enrichmentResult && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Original:</p>
                <p className="font-medium text-gray-900 dark:text-white">{enrichmentResult.originalName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Clean Name:</p>
                <p className="font-medium text-gray-900 dark:text-white">{enrichmentResult.cleanName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Category:</p>
                <p className="font-medium text-gray-900 dark:text-white">{enrichmentResult.category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Industry:</p>
                <p className="font-medium text-gray-900 dark:text-white">{enrichmentResult.industry}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Confidence:</p>
                <span className={`font-medium ${getConfidenceColor(enrichmentResult.confidence)}`}>
                  {(enrichmentResult.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tags:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {enrichmentResult.suggestedTags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Merchants</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {merchants.length}
              </p>
            </div>
            <BuildingIcon size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">High Confidence</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {merchants.filter(m => m.confidence >= 0.9).length}
              </p>
            </div>
            <CheckCircleIcon size={24} className="text-green-500" />
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {merchants.length > 0 ? Math.round((merchants.filter(m => m.confidence >= 0.9).length / merchants.length) * 100) : 0}% accuracy
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {categories.length - 1}
              </p>
            </div>
            <TagIcon size={24} className="text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {merchants.length > 0 ? Math.round((merchants.reduce((sum, m) => sum + m.confidence, 0) / merchants.length) * 100) : 0}%
              </p>
            </div>
            <BarChart3Icon size={24} className="text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <SearchIcon size={16} className="text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search merchants..."
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <FilterIcon size={16} className="text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="confidence">Confidence</option>
            <option value="name">Name</option>
            <option value="frequency">Frequency</option>
            <option value="lastUpdated">Last Updated</option>
          </select>
        </div>
      </div>

      {/* Merchants List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {filteredMerchants.length === 0 ? (
          <div className="text-center py-8">
            <SearchIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">No merchants found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Merchant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Avg Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMerchants.map((merchant) => (
                  <tr key={merchant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {merchant.cleanName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {merchant.tags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="inline-block mr-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white">
                        {merchant.category}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white">
                        {merchant.industry}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceBadge(merchant.confidence)}`}>
                        <StarIcon size={12} />
                        {(merchant.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white capitalize">
                        {merchant.frequency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white">
                        {merchant.avgTransactionAmount ? formatCurrency(merchant.avgTransactionAmount) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300">
                          <EyeIcon size={16} />
                        </button>
                        <button className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300">
                          <EditIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}