import React, { useEffect, memo } from 'react';
import { ClockIcon, PlusIcon, PlayIcon, StopIcon, EditIcon, TrashIcon } from '../icons';
import type { ThemeSchedule } from '../../services/themeSchedulingService';
import { logger } from '../../services/loggingService';

interface SchedulesTabProps {
  schedules: ThemeSchedule[];
  onCreateClick: () => void;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onEdit: (schedule: ThemeSchedule) => void;
  onDelete: (id: string) => void;
  formatTime: (time: string) => string;
  formatDays: (days: number[]) => string;
  getScheduleBorderClass: (isActive: boolean) => string;
}

const SchedulesTab = memo(function SchedulesTab({
  schedules,
  onCreateClick,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
  formatTime,
  formatDays,
  getScheduleBorderClass
}: SchedulesTabProps): React.JSX.Element {
  // Component initialization logging
  useEffect(() => {
    logger.info('SchedulesTab component initialized', {
      componentName: 'SchedulesTab'
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Theme Schedules</h3>
        <button
          onClick={onCreateClick}
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
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onActivate={onActivate}
              onDeactivate={onDeactivate}
              onEdit={onEdit}
              onDelete={onDelete}
              formatTime={formatTime}
              formatDays={formatDays}
              getScheduleBorderClass={getScheduleBorderClass}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const ScheduleCard = memo(function ScheduleCard({
  schedule,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
  formatTime,
  formatDays,
  getScheduleBorderClass
}: {
  schedule: ThemeSchedule;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onEdit: (schedule: ThemeSchedule) => void;
  onDelete: (id: string) => void;
  formatTime: (time: string) => string;
  formatDays: (days: number[]) => string;
  getScheduleBorderClass: (isActive: boolean) => string;
}): React.JSX.Element {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border-2 ${getScheduleBorderClass(schedule.isActive)}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${schedule.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{schedule.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
              {schedule.scheduleType.replace('-', ' ')} schedule
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => schedule.isActive ? onDeactivate() : onActivate(schedule.id)}
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
            onClick={() => onEdit(schedule)}
            className="p-2 text-gray-600 dark:text-gray-500 hover:text-blue-900 dark:hover:text-gray-300"
            title="Edit schedule"
          >
            <EditIcon size={16} />
          </button>
          <button
            onClick={() => onDelete(schedule.id)}
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
  );
});

export default SchedulesTab;