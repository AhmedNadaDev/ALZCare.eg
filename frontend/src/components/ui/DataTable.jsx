import React, { useState } from 'react';

const SortIcon = ({ active, direction }) => (
  <svg className={`inline-block w-3.5 h-3.5 ml-1 ${active ? 'text-purple-400' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {direction === 'asc' ? (
      <path d="M12 5v14M5 12l7-7 7 7" />
    ) : direction === 'desc' ? (
      <path d="M12 19V5M5 12l7 7 7-7" />
    ) : (
      <>
        <path d="M8 9l4-4 4 4" opacity="0.4" />
        <path d="M8 15l4 4 4-4" opacity="0.4" />
      </>
    )}
  </svg>
);

const DataTable = ({
  columns = [],
  data = [],
  onRowClick,
  sortKey: controlledSortKey,
  sortDir: controlledSortDir,
  onSort,
  emptyState,
  loading = false,
  className = '',
}) => {
  const [internalSortKey, setInternalSortKey] = useState(null);
  const [internalSortDir, setInternalSortDir] = useState('asc');

  const sortKey = controlledSortKey ?? internalSortKey;
  const sortDir = controlledSortDir ?? internalSortDir;

  const handleSort = (key) => {
    const sortable = columns.find((c) => c.key === key)?.sortable;
    if (!sortable) return;

    if (onSort) {
      onSort(key, sortKey === key && sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      if (internalSortKey === key) {
        setInternalSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setInternalSortKey(key);
        setInternalSortDir('asc');
      }
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey || onSort) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;

    return [...data].sort((a, b) => {
      const aVal = col.sortValue ? col.sortValue(a) : a[sortKey];
      const bVal = col.sortValue ? col.sortValue(b) : b[sortKey];
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir, columns, onSort]);

  if (!loading && sortedData.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 ${
                    col.sortable ? 'cursor-pointer hover:text-gray-300 select-none' : ''
                  } ${col.headerClassName || ''}`}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.header}
                  {col.sortable && (
                    <SortIcon
                      active={sortKey === col.key}
                      direction={sortKey === col.key ? sortDir : null}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-4">
                        <div className="h-4 bg-white/[0.05] rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedData.map((row, rowIdx) => (
                  <tr
                    key={row.id || row._id || rowIdx}
                    className={`hover:bg-white/[0.03] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-4 ${col.cellClassName || ''}`}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white/[0.03] rounded-xl border border-white/[0.08] p-4 animate-pulse">
                <div className="h-4 bg-white/[0.05] rounded w-3/4 mb-2" />
                <div className="h-3 bg-white/[0.05] rounded w-1/2" />
              </div>
            ))
          : sortedData.map((row, rowIdx) => (
              <div
                key={row.id || row._id || rowIdx}
                className={`bg-white/[0.03] rounded-xl border border-white/[0.08] p-4 hover:bg-white/[0.05] transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {columns
                  .filter((col) => !col.hideOnMobile)
                  .map((col) => (
                    <div key={col.key} className={col.mobileClassName || ''}>
                      {col.renderMobile
                        ? col.renderMobile(row)
                        : col.render
                        ? col.render(row)
                        : (
                            <div className="flex items-center justify-between py-1">
                              <span className="text-xs text-gray-500">{col.header}</span>
                              <span className="text-sm text-white">{row[col.key]}</span>
                            </div>
                          )}
                    </div>
                  ))}
              </div>
            ))}
      </div>
    </div>
  );
};

export default DataTable;
