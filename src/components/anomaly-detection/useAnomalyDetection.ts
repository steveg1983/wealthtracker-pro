import { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContextSupabase';
import { useNavigate } from 'react-router-dom';
import { anomalyDetectionService, type Anomaly, type AnomalyDetectionConfig } from '../../services/anomalyDetectionService';

export function useAnomalyDetection() {
  const { transactions, categories } = useApp();
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AnomalyDetectionConfig>(anomalyDetectionService.getConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  useEffect(() => {
    detectAnomalies();
  }, [transactions, categories]);

  const detectAnomalies = async () => {
    setLoading(true);
    try {
      const detected = await anomalyDetectionService.detectAnomalies(transactions, categories);
      setAnomalies(detected);
      anomalyDetectionService.saveAnomalies(detected);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAnomaly = (anomalyId: string) => {
    anomalyDetectionService.dismissAnomaly(anomalyId);
    setAnomalies(anomalies.filter(a => a.id !== anomalyId));
  };

  const handleViewTransaction = (transactionId?: string) => {
    if (transactionId) {
      navigate(`/transactions?highlight=${transactionId}`);
    }
  };

  const handleToggleType = (type: Anomaly['type']) => {
    const newTypes = new Set(config.enabledTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    const newConfig = { ...config, enabledTypes: newTypes };
    setConfig(newConfig);
    anomalyDetectionService.saveConfig(newConfig);
  };

  const handleSensitivityChange = (level: 'low' | 'medium' | 'high') => {
    const newConfig = { ...config, sensitivityLevel: level };
    setConfig(newConfig);
    anomalyDetectionService.saveConfig(newConfig);
  };

  const activeAnomalies = anomalies.filter(a => !a.dismissed);
  const highPriorityCount = activeAnomalies.filter(a => a.severity === 'high').length;
  const mediumPriorityCount = activeAnomalies.filter(a => a.severity === 'medium').length;
  const lowPriorityCount = activeAnomalies.filter(a => a.severity === 'low').length;

  return {
    anomalies: activeAnomalies,
    loading,
    config,
    showSettings,
    setShowSettings,
    selectedAnomaly,
    setSelectedAnomaly,
    handleDismissAnomaly,
    handleViewTransaction,
    handleToggleType,
    handleSensitivityChange,
    detectAnomalies,
    highPriorityCount,
    mediumPriorityCount,
    lowPriorityCount
  };
}