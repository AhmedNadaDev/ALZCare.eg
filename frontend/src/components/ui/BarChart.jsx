import React, { useState, useEffect, useRef } from 'react';

const BarChart = ({
  bars = [],
  animated = true,
  showValues = true,
  className = '',
}) => {
  const [visible, setVisible] = useState(!animated);
  const ref = useRef(null);

  useEffect(() => {
    if (!animated) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [animated]);

  const maxValue = Math.max(...bars.map((b) => b.maxValue ?? b.value), 1);

  return (
    <div ref={ref} className={`space-y-3 ${className}`}>
      {bars.map((bar, i) => {
        const percentage = Math.min((bar.value / (bar.maxValue ?? maxValue)) * 100, 100);
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: bar.color }}
                />
                <span className="text-sm text-gray-400">{bar.label}</span>
              </div>
              {showValues && (
                <span className="text-sm font-medium text-white">
                  {bar.value}
                  {bar.suffix || ''}
                </span>
              )}
            </div>
            <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: visible ? `${percentage}%` : '0%',
                  backgroundColor: bar.color,
                  transitionDelay: `${i * 150}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BarChart;
