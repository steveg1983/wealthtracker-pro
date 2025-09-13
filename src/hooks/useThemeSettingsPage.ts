import { useState, useEffect, useCallback } from 'react';
import { themeSettingsPageService, type ActiveTab, type SystemSettings } from '../services/themeSettingsPageService';
import type { ThemeSchedule, ThemePreset } from '../services/themeSchedulingService';
import { logger } from '../services/loggingService';

export function useThemeSettingsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('schedules');
  const [schedules, setSchedules] = useState<ThemeSchedule[]>([]);
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<ThemeSchedule | null>(null);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showCreatePreset, setShowCreatePreset] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ThemeSchedule | null>(null);
  const [nextThemeChange, setNextThemeChange] = useState<{ time: string; theme: 'light' | 'dark' } | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(
    themeSettingsPageService.getDefaultSystemSettings()
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await themeSettingsPageService.loadThemeData();
      setSchedules(data.schedules);
      setPresets(data.presets);
      setCurrentSchedule(data.currentSchedule);
    } catch (error) {
      logger.error('Failed to load theme data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    // Set up theme change callback
    themeSettingsPageService.setThemeChangeCallback((theme) => {
      logger.info('Theme changed', { theme });
      loadData(); // Refresh data after theme changes
    });

    // Update next theme change info
    const updateNextChange = () => {
      setNextThemeChange(themeSettingsPageService.getNextThemeChange());
    };
    
    updateNextChange();
    const interval = setInterval(updateNextChange, 60000); // Update every minute

    return () => {
      clearInterval(interval);
    };
  }, [loadData]);

  const handleActivateSchedule = useCallback((id: string) => {
    themeSettingsPageService.activateSchedule(id);
    loadData();
  }, [loadData]);

  const handleDeactivateSchedule = useCallback(() => {
    themeSettingsPageService.deactivateSchedule();
    loadData();
  }, [loadData]);

  const handleDeleteSchedule = useCallback((id: string) => {
    if (themeSettingsPageService.deleteSchedule(id)) {
      loadData();
    }
  }, [loadData]);

  const handleDeletePreset = useCallback((id: string) => {
    if (themeSettingsPageService.deletePreset(id, presets)) {
      loadData();
    }
  }, [presets, loadData]);

  const handleCreateSchedule = useCallback((scheduleData: Omit<ThemeSchedule, 'id' | 'createdAt' | 'lastUpdated'>) => {
    themeSettingsPageService.createSchedule(scheduleData);
    loadData();
    setShowCreateSchedule(false);
  }, [loadData]);

  const handleSystemSettingChange = useCallback((setting: keyof SystemSettings, value: boolean) => {
    setSystemSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  }, []);

  const getCurrentTheme = useCallback(() => {
    return themeSettingsPageService.getCurrentTheme();
  }, []);

  const formatTime = useCallback((time: string) => {
    return themeSettingsPageService.formatTime(time);
  }, []);

  const formatDays = useCallback((days: number[]) => {
    return themeSettingsPageService.formatDays(days);
  }, []);

  const getTabButtonClass = useCallback((isActive: boolean) => {
    return themeSettingsPageService.getTabButtonClass(isActive);
  }, []);

  const getScheduleBorderClass = useCallback((isActive: boolean) => {
    return themeSettingsPageService.getScheduleBorderClass(isActive);
  }, []);

  return {
    // State
    activeTab,
    schedules,
    presets,
    currentSchedule,
    showCreateSchedule,
    showCreatePreset,
    editingSchedule,
    nextThemeChange,
    systemSettings,
    isLoading,
    
    // Actions
    setActiveTab,
    setShowCreateSchedule,
    setShowCreatePreset,
    setEditingSchedule,
    handleActivateSchedule,
    handleDeactivateSchedule,
    handleDeleteSchedule,
    handleDeletePreset,
    handleCreateSchedule,
    handleSystemSettingChange,
    
    // Utilities
    getCurrentTheme,
    formatTime,
    formatDays,
    getTabButtonClass,
    getScheduleBorderClass
  };
}