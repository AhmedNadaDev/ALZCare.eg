import React from 'react';

const defaultColors = {
  medication_reminder: '#3b82f6',
  medication_missed: '#ef4444',
  mood_abnormal: '#f59e0b',
  mood_entry: '#a855f7',
  new_patient: '#22c55e',
  patient_update: '#6366f1',
  system_alert: '#64748b',
  family_activity: '#ec4899',
  appointment_reminder: '#06b6d4',
  default: '#a855f7',
};

const Timeline = ({
  items = [],
  maxItems = 8,
  className = '',
}) => {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 text-gray-500 text-sm ${className}`}>
        No recent activity
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-white/[0.08]" />

      <div className="space-y-4">
        {displayItems.map((item, i) => {
          const dotColor = item.color || defaultColors[item.type] || defaultColors.default;
          return (
            <div key={item.id || i} className="relative flex gap-4 pl-7">
              {/* Dot */}
              <span
                className="absolute left-0 top-1.5 w-[18px] h-[18px] rounded-full border-2 flex-shrink-0"
                style={{
                  borderColor: dotColor,
                  backgroundColor: `${dotColor}33`,
                }}
              />
              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-white font-medium truncate">{item.title}</p>
                  <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{item.time}</span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
