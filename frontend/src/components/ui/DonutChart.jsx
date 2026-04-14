import React, { useState, useEffect, useRef } from 'react';

const DonutChart = ({
  segments = [],
  size = 180,
  thickness = 24,
  centerLabel = '',
  centerValue = '',
  className = '',
}) => {
  const [animated, setAnimated] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let cumulativeOffset = 0;

  return (
    <div ref={ref} className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={thickness}
          />
          {/* Segment arcs */}
          {total > 0 && segments.map((segment, i) => {
            const segmentLength = (segment.value / total) * circumference;
            const offset = circumference - (animated ? segmentLength : 0);
            const rotation = (cumulativeOffset / total) * 360;
            cumulativeOffset += segment.value;

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: '50% 50%',
                  transition: animated ? `stroke-dashoffset 1s ease-out ${i * 0.15}s` : 'none',
                }}
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue !== '' && (
            <span className="text-2xl font-bold text-white">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-xs text-gray-400 mt-0.5">{centerLabel}</span>
          )}
        </div>
      </div>

      {/* Legend */}
      {segments.length > 0 && (
        <div className="mt-4 space-y-2 w-full">
          {segments.map((segment, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-gray-400">{segment.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{segment.value}</span>
                {total > 0 && (
                  <span className="text-gray-500 text-xs">
                    ({Math.round((segment.value / total) * 100)}%)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DonutChart;
