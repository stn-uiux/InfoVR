import React, { useState, useMemo } from "react";
import { Icon } from "@iconify/react";

export interface StnTableColumn<T> {
  key: string;
  title: React.ReactNode;
  width?: string;
  className?: string;
  render?: (record: T, index: number) => React.ReactNode;
  sortable?: boolean; // enable sort on this column
  sortValue?: (record: T) => string | number; // value extractor for sorting
}

export interface StnTableProps<T> {
  columns: StnTableColumn<T>[];
  data: T[];
  rowKey: (record: T) => string | number;
  selectedRowKeys?: (string | number)[];
  onSelectionChange?: (selectedKeys: (string | number)[]) => void;
  onRowClick?: (record: T) => void;
  emptyText?: React.ReactNode;
  containerStyle?: React.CSSProperties;
}

export function StnTable<T>({
  columns,
  data,
  rowKey,
  selectedRowKeys,
  onSelectionChange,
  onRowClick,
  emptyText = "데이터가 없습니다.",
  containerStyle,
}: StnTableProps<T>) {
  const isMultiSelect = selectedRowKeys !== undefined && onSelectionChange !== undefined;

  // Sorting state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: StnTableColumn<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find(c => c.key === sortKey);
    if (!col || !col.sortValue) return data;
    const extractor = col.sortValue;
    return [...data].sort((a, b) => {
      const va = extractor(a);
      const vb = extractor(b);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectionChange?.(sortedData.map(rowKey));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleRowSelect = (e: React.ChangeEvent<HTMLInputElement>, record: T) => {
    if (!selectedRowKeys || !onSelectionChange) return;
    const key = rowKey(record);
    if (e.target.checked) {
      onSelectionChange([...selectedRowKeys, key]);
    } else {
      onSelectionChange(selectedRowKeys.filter((k) => k !== key));
    }
  };

  const isAllSelected = sortedData.length > 0 && selectedRowKeys?.length === sortedData.length;

  return (
    <div className="stn-table-container" style={containerStyle}>
      <div className="stn-table-scroll stn-table-content">
        <table className="stn-table">
          <thead>
            <tr>
              {isMultiSelect && (
                <th className="col-check" style={{ width: "44px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      disabled={sortedData.length === 0}
                    />
                  </div>
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${col.className || ""} ${col.sortable ? "sortable" : ""}`}
                  style={{ width: col.width, cursor: col.sortable ? "pointer" : undefined }}
                  onClick={() => col.sortable && handleSort(col)}
                >
                  <div className="stn-table-th-content">
                    {col.title}
                    {col.sortable && (
                      <span className="sort-indicator">
                        {sortKey === col.key ? (
                          <Icon
                            icon={sortDir === "asc" ? "material-symbols:arrow-upward" : "material-symbols:arrow-downward"}
                            style={{ fontSize: "14px", color: "var(--theme-primary)" }}
                          />
                        ) : (
                          <Icon
                            icon="material-symbols:swap-vert"
                            style={{ fontSize: "14px", opacity: 0.3 }}
                          />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (isMultiSelect ? 1 : 0)} style={{ textAlign: "center", padding: "32px 16px" }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              sortedData.map((record, index) => {
                const key = rowKey(record);
                const isSelected = selectedRowKeys?.includes(key);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(record)}
                    style={{ background: isSelected ? "rgba(91, 124, 247, 0.05)" : undefined }}
                  >
                    {isMultiSelect && (
                      <td className="col-check">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleRowSelect(e, record);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.render ? col.render(record, index) : (record as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
