import React from 'react';

/**
 * Displays a coloured pill indicating whether the patient is inside or outside
 * the safety zone.
 *
 * @param {'inside'|'outside'|'unknown'|null} status
 * @param {string|null} lastUpdated - ISO string or Date for "X seconds ago" display
 */
const StatusBadge = ({ status, lastUpdated }) => {
  const config = {
    inside: {
      dot: 'bg-emerald-400 animate-pulse',
      pill: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
      label: 'Inside Safe Zone',
    },
    outside: {
      dot: 'bg-red-500 animate-pulse',
      pill: 'bg-red-500/20 border-red-500/40 text-red-400',
      label: 'Outside Safe Zone',
    },
    unknown: {
      dot: 'bg-gray-500',
      pill: 'bg-gray-500/20 border-gray-500/40 text-gray-400',
      label: 'Status Unknown',
    },
  };

  const key = status && config[status] ? status : 'unknown';
  const { dot, pill, label } = config[key];

  const secondsAgo = lastUpdated
    ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / 1000)
    : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <span
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${pill}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {label}
      </span>
      {secondsAgo !== null && (
        <span className="text-xs text-gray-500">
          Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}
        </span>
      )}
    </div>
  );
};

export default StatusBadge;
