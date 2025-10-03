import React, { useState, useEffect } from 'react';
import { themeSchedulingService } from '../../services/themeSchedulingService';
import type { ThemeSchedule, ThemePreset } from '../../services/themeSchedulingService';
import { useLogger } from '../services/ServiceProvider';
import { 
  MoonIcon,
  SunIcon,
  ClockIcon,
  MapPinIcon,
  PaletteIcon,
  SettingsIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  EyeIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from '../../components/icons';
import PageWrapper from '../../components/PageWrapper';

type ActiveTab = 'schedules' | 'presets' | 'settings';

export default function ThemeSettings() {
  const logger = useLogger();
  const [activeTab, setActiveTab] = useState<ActiveTab>('schedules');
  const [schedules, setSchedules] = useState<ThemeSchedule[]>([]);
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<ThemeSchedule | null>(null);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showCreatePreset, setShowCreatePreset] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ThemeSchedule | null>(null);
  const [nextThemeChange, setNextThemeChange] = useState<{ time: string; theme: 'light' | 'dark' } | null>(null);

  useEffect(() => {
    loadData();
    
    // Set up theme change callback
    themeSchedulingService.setThemeChangeCallback((theme) => {
      logger.info('Theme changed', { theme });
      loadData(); // Refresh data after theme changes
    });

    // Update next theme change info
    const updateNextChange = () => {
      setNextThemeChange(themeSchedulingService.getNextThemeChange());
    };
    
    updateNextChange();
    const interval = setInterval(updateNextChange, 60000); // Update every minute

    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadData = () => {
    setSchedules(themeSchedulingService.getSchedules());
    setPresets(themeSchedulingService.getPresets());
    setCurrentSchedule(themeSchedulingService.getCurrentSchedule());
  };

  const handleActivateSchedule = (id: string) => {
    themeSchedulingService.activateSchedule(id);
    loadData();
  };

  const handleDeactivateSchedule = () => {
    themeSchedulingService.deactivateSchedule();
    loadData();
  };

  const handleDeleteSchedule = (id: string) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      themeSchedulingService.deleteSchedule(id);
      loadData();
    }
  };

  const handleDeletePreset = (id: string) => {
    const preset = presets.find(p => p.id === id);
    if (preset && !preset.isCustom) {
      alert('Cannot delete default presets');
      return;
    }
    
    if (confirm('Are you sure you want to delete this preset?')) {
      themeSchedulingService.deletePreset(id);
      loadData();
    }
  };

  const handleCreateSchedule = (scheduleData: Omit<ThemeSchedule, 'id' | 'createdAt' | 'lastUpdated'>) => {
    themeSchedulingService.createSchedule(scheduleData);
    loadData();
    setShowCreateSchedule(false);
  };

  const getCurrentTheme = () => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDays = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => dayNames[day]).join(', ');
  };

  return (
    <PageWrapper title="Theme Settings">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-gray-600 dark:from-purple-800 dark:to-gray-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Theme Settings</h1>
              <p className="text-purple-100">
                Customize appearance and automate theme switching
              </p>
            </div>
            <div className="flex items-center gap-4">
              {getCurrentTheme() === 'dark' ? (
                <MoonIcon size={48} className="text-white/80" />
              ) : (
                <SunIcon size={48} className="text-white/80" />
              )}
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              {getCurrentTheme() === 'dark' ? (
                <MoonIcon size={20} className="text-gray-600 dark:text-gray-500" />
              ) : (
                <SunIcon size={20} className="text-yellow-600 dark:text-yellow-400" />
              )}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Current Theme</p>
                <p className="font-semibold text-gray-900 dark:text-white capitalize">
                  {getCurrentTheme()} Mode
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              <ClockIcon size={20} className="text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Schedule</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {currentSchedule ? currentSchedule.name : 'None'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3">
              <RefreshCwIcon size={20} className="text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Next Change</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {nextThemeChange ? `${formatTime(nextThemeChange.time)} (${nextThemeChange.theme})` : 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('schedules')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'schedules'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} />
                  Schedules ({schedules.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'presets'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <PaletteIcon size={16} />
                  Presets ({presets.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <SettingsIcon size={16} />
                  Advanced
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Schedules Tab */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Theme Schedules</h3>
              <button
                onClick={() => setShowCreateSchedule(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                <PlusIcon size={16} />
                Create Schedule
              </button>
            </div>

            {schedules.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
                <ClockIcon size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">No theme schedules created yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border-2 ${
                      schedule.isActive
                        ? 'border-green-500 dark:border-green-400'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          schedule.isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {schedule.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {schedule.scheduleType.replace('-', ' ')} schedule
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => schedule.isActive ? handleDeactivateSchedule() : handleActivateSchedule(schedule.id)}
                          className={`p-2 rounded ${
                            schedule.isActive
                              ? 'text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300'
                              : 'text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300'
                          }`}
                          title={schedule.isActive ? 'Deactivate schedule' : 'Activate schedule'}
                        >
                          {schedule.isActive ? <StopIcon size={16} /> : <PlayIcon size={16} />}
                        </button>
                        <button
                          onClick={() => setEditingSchedule(schedule)}
                          className="p-2 text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300"
                          title="Edit schedule"
                        >
                          <EditIcon size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          title="Delete schedule"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      {schedule.scheduleType === 'time-based' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Light mode:</span>
                            <span className="text-gray-900 dark:text-white">
                              {schedule.lightModeStart ? formatTime(schedule.lightModeStart) : 'Not set'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Dark mode:</span>
                            <span className="text-gray-900 dark:text-white">
                              {schedule.darkModeStart ? formatTime(schedule.darkModeStart) : 'Not set'}
                            </span>
                          </div>
                        </>
                      )}

                      {schedule.scheduleType === 'sunrise-sunset' && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Location:</span>
                          <span className="text-gray-900 dark:text-white">
                            {schedule.latitude && schedule.longitude
                              ? `${schedule.latitude.toFixed(2)}, ${schedule.longitude.toFixed(2)}`
                              : 'Not set'
                            }
                          </span>
                        </div>
                      )}

                      {schedule.activeDays && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Active days:</span>
                          <span className="text-gray-900 dark:text-white">
                            {formatDays(schedule.activeDays)}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-500">Weekend:</span>
                          <span className="text-gray-700 dark:text-gray-300 capitalize">
                            {schedule.weekendBehavior?.replace('-', ' ') || 'Follow schedule'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Theme Presets</h3>
              <button
                onClick={() => setShowCreatePreset(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
              >
                <PlusIcon size={16} />
                Create Preset
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {presets.map((preset) => (
                <div key={preset.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {preset.name}
                        {!preset.isCustom && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-gray-900/20 dark:text-blue-200 px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {preset.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-2 text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300"
                        title="Preview preset"
                      >
                        <EyeIcon size={16} />
                      </button>
                      {preset.isCustom && (
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          title="Delete preset"
                        >
                          <TrashIcon size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Color Preview */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Light Theme</p>
                      <div className="flex gap-2">
                        {Object.entries(preset.lightTheme).slice(0, 4).map(([key, color]) => (
                          <div
                            key={key}
                            className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600"
                            style={{ backgroundColor: color }}
                            title={key}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Dark Theme</p>
                      <div className="flex gap-2">
                        {Object.entries(preset.darkTheme).slice(0, 4).map(([key, color]) => (
                          <div
                            key={key}
                            className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600"
                            style={{ backgroundColor: color }}
                            title={key}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Settings</h3>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">System Integration</h4>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-700 dark:text-gray-300">Follow system theme</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Automatically use your operating system's theme preference
                    </p>
                  </div>
                  <input type="checkbox" className="ml-4" />
                </label>
                
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-700 dark:text-gray-300">Override system preferences</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Allow scheduled themes to override system settings
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="ml-4" />
                </label>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Performance</h4>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-700 dark:text-gray-300">Smooth transitions</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Enable animated transitions when switching themes
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="ml-4" />
                </label>
                
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-700 dark:text-gray-300">Reduce motion</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Minimize animations for better performance
                    </p>
                  </div>
                  <input type="checkbox" className="ml-4" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Create Schedule Modal - Simplified for this implementation */}
        {showCreateSchedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Create Theme Schedule
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Schedule creation modal would be implemented here with full form controls.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateSchedule(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowCreateSchedule(false)}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
