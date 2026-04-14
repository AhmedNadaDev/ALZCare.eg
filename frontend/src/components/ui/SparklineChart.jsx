import React, { useState, useEffect, useRef } from 'react';

const SparklineChart = ({
  data = [],
  width = 400,
  height = 160,
  color = '#a855f7',
  fillOpacity = 0.15,
  showDots = true,
  showLabels = true,
  yMin = 0,
  yMax,
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

  if (data.length < 2) {
    return (
      <div className={`flex items-center justify-center text-gray-500 text-sm ${className}`} style={{ width, height }}>
        Not enough data
      </div>
    );
  }

  const padding = { top: 12, right: 12, bottom: showLabels ? 28 : 12, left: 12 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const yValues = data.map((d) => d.y);
  const computedYMax = yMax ?? Math.max(...yValues);
  const yRange = computedYMax - yMin || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((d.y - yMin) / yRange) * chartH,
    label: d.x,
    value: d.y,
  }));

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${points[0].x},${padding.top + chartH} ${linePoints} ${points[points.length - 1].x},${padding.top + chartH}`;

  return (
    <div ref={ref} className={className}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`sparkFill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => {
          const gridY = padding.top + chartH * (1 - frac);
          return (
            <line
              key={frac}
              x1={padding.left}
              y1={gridY}
              x2={padding.left + chartW}
              y2={gridY}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Area fill */}
        <polygon
          points={areaPoints}
          fill={`url(#sparkFill-${color.replace('#', '')})`}
          className={animated ? 'transition-opacity duration-1000' : ''}
          opacity={animated ? 1 : 0}
        />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animated ? 'transition-opacity duration-700' : ''}
          opacity={animated ? 1 : 0}
        />

        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill="#0a0118"
                stroke={color}
                strokeWidth={2}
                className={animated ? 'transition-opacity duration-500' : ''}
                opacity={animated ? 1 : 0}
                style={{ transitionDelay: `${i * 80}ms` }}
              />
              {/* Value label on hover target */}
              <title>{`${p.label}: ${p.value}`}</title>
            </g>
          ))}

        {/* X-axis labels */}
        {showLabels &&
          points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              className="fill-gray-500 text-[11px]"
            >
              {p.label}
            </text>
          ))}
      </svg>
    </div>
  );
};

export default SparklineChart;
