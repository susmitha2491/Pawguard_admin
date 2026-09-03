import React, { useState, useMemo } from "react";
import { FaSearch, FaChevronLeft, FaChevronRight, FaEdit, FaTrash, FaSave, FaExclamationTriangle } from "react-icons/fa";
import Modal from "./Modal";
import { useToast } from "../../context/ToastContext";
import { usePermissions } from "../../context/PermissionContext";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";

export interface Column<T = any> {
  key: string;
  title?: string;
  header?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onRowClick?: (row: T) => void;
  renderRowActions?: (row: T) => React.ReactNode;
  /** Permission module name used to gate Edit/Delete actions (e.g. "users"). */
  module?: string;
  /** Server-driven mode: search + pagination are delegated to the parent. */
  serverMode?: boolean;
  /** Total row count (server mode) used for pagination and counts. */
  totalCount?: number;
  /** Current page (server mode, 1-based). */
  page?: number;
  /** Called with the new page when the user navigates (server mode). */
  onPageChange?: (page: number) => void;
  /** Controlled search term (server mode). */
  searchValue?: string;
  /** Called when the search term changes (server mode). */
  onSearchChange?: (term: string) => void;
  /** Option to hide the internal search input box. */
  hideSearch?: boolean;
  /** Custom controls to render on the left side of the table header row. */
  leftHeaderControls?: React.ReactNode;
  /** Option to hide the pagination footer bar. */
  hidePagination?: boolean;
  /** Custom max width for the table search box (e.g. "480px"). */
  searchMaxWidth?: string;
}

function DataTable<T = any>({
  columns,
  data,
  pageSize = 5,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = "No matching records found.",
  onView: _onView,
  onEdit,
  onDelete,
  onRowClick,
  module,
  renderRowActions,
  serverMode = false,
  totalCount = 0,
  page: controlledPage,
  onPageChange,
  searchValue,
  onSearchChange,
  hideSearch = false,
  hidePagination = false,
  leftHeaderControls,
  searchMaxWidth,
}: DataTableProps<T>): React.ReactElement {
  const { addToast } = useToast();
  const { can } = usePermissions();
  const canEdit = !module || can("edit", module);
  const canDelete = !module || can("delete", module);
  const showRowActions = !!renderRowActions;
  const actionColCount = columns.length + (showRowActions ? 1 : 0);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const goToPage = (next: number) => {
    if (serverMode) {
      if (onPageChange) onPageChange(next);
    } else {
      setCurrentPage(next);
    }
  };

  // Modal State
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit" | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  // Filter
  const filteredData = useMemo(() => {
    if (serverMode) return data;
    if (!searchTerm.trim()) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = (row as Record<string, any>)[col.key];
        return val !== undefined && val !== null && String(val).toLowerCase().includes(lower);
      })
    );
  }, [data, searchTerm, columns, serverMode]);

  // Pagination
  const activePage = serverMode ? (controlledPage ?? 1) : currentPage;
  const totalRecords = serverMode ? (totalCount || 0) : filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pageData = useMemo(() => {
    if (serverMode) return data;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize, serverMode, data]);

  const renderStatusBadge = (val: string) => {
    const lower = val.toLowerCase();
    let bg = "#F1F5F9";
    let color = "#475569";

    if (
      lower.includes("success") ||
      lower.includes("completed") ||
      lower.includes("approved") ||
      lower.includes("healthy") ||
      lower.includes("discharged") ||
      lower.includes("recovered")
    ) {
      bg = "#F0FDF4";
      color = "#15803D";
    } else if (
      lower.includes("pending") ||
      lower.includes("treatment") ||
      lower.includes("warning") ||
      lower.includes("assigned")
    ) {
      bg = "#FFFBEB";
      color = "#D97706";
    } else if (
      lower.includes("critical") ||
      lower.includes("failed") ||
      lower.includes("urgent") ||
      lower.includes("rejected") ||
      lower.includes("destructive")
    ) {
      bg = "#FEF2F2";
      color = "#DC2626";
    } else if (lower.includes("active") || lower.includes("in progress")) {
      bg = "#EFF6FF";
      color = "#1E3A8A";
    }

    return (
      <span
        style={{
          background: bg,
          color: color,
          padding: "4px 10px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 700,
          display: "inline-block",
          textTransform: "capitalize",
          whiteSpace: "nowrap",
        }}
      >
        {val}
      </span>
    );
  };

  const handleRowClick = (e: React.MouseEvent, row: T) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        "button, input, select, textarea, a, svg, label, [role='button'], .no-row-click"
      )
    ) {
      return;
    }
    if (onRowClick) {
      onRowClick(row);
    } else if (_onView) {
      _onView(row);
    } else {
      setSelectedRow(row as unknown as Record<string, any>);
      setModalMode("view");
    }
  };

  const handleStartEdit = () => {
    if (selectedRow) {
      setEditFormData({ ...selectedRow });
      setModalMode("edit");
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedRow) return;
    try {
      if (onEdit) {
        await onEdit(editFormData as unknown as T);
      }
      addToast("Record updated successfully!", "success");
      notifyDataChanged();
      setModalMode(null);
      setSelectedRow(null);
    } catch (err: any) {
      addToast(err?.message || "Failed to update record.", "error");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedRow) return;
    try {
      if (onDelete) {
        await onDelete(selectedRow as unknown as T);
      }
      addToast("Record deleted successfully!", "success");
      notifyDataChanged();
      setIsDeleteConfirmOpen(false);
      setModalMode(null);
      setSelectedRow(null);
    } catch (err: any) {
      addToast(err?.message || "Failed to delete record.", "error");
    }
  };

  const formatLabel = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (col) return col.title || col.header || key;
    return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div style={{ width: "100%", overflow: "visible" }}>
      {/* Search Header */}
      {(leftHeaderControls || !hideSearch) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", flex: "1 1 auto" }}>
            {!hideSearch && (
              <div style={{ position: "relative", width: "100%", maxWidth: searchMaxWidth || "320px", flex: "1 1 200px" }}>
                <FaSearch
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                    fontSize: "14px",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={serverMode ? (searchValue ?? "") : searchTerm}
                  onChange={(e) => {
                    if (serverMode) {
                      if (onSearchChange) onSearchChange(e.target.value);
                    } else {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: searchMaxWidth ? "10px 14px 10px 38px" : "9px 12px 9px 36px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: searchMaxWidth ? "14px" : "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
            {leftHeaderControls}
          </div>
        </div>
      )}

      {/* Responsive Table Wrapper */}
      <div className="table-responsive-container" style={{ overflowX: "auto", width: "100%", maxWidth: "100%", minWidth: 0, WebkitOverflowScrolling: "touch" }}>
        <table
          style={{
            width: "100%",
            minWidth: "100%",
            tableLayout: "auto",
            borderCollapse: "separate",
            borderSpacing: 0,
            background: "#FFFFFF",
            fontSize: "13px",
            textAlign: "left",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
          }}
        >
          <thead
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <tr style={{ background: "#F8FAFC" }}>
              {columns.map((col, ci) => (
                <th
                  key={col.key}
                  style={{
                    padding: "14px 16px",
                    fontWeight: 700,
                    color: "#475569",
                    cursor: "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    background: "#F8FAFC",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    borderBottom: "1px solid #E2E8F0",
                    borderTopLeftRadius: ci === 0 ? "11px" : 0,
                  }}
                >
                  {col.title || col.header || col.key}
                </th>
              ))}
              {showRowActions && (
                <th
                  style={{
                    padding: "14px 16px",
                    fontWeight: 700,
                    color: "#475569",
                    whiteSpace: "nowrap",
                    textAlign: "right",
                    background: "#F8FAFC",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    borderBottom: "1px solid #E2E8F0",
                    borderTopRightRadius: "11px",
                  }}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={actionColCount}
                  style={{ padding: "40px", textAlign: "center", color: "#1E3A8A" }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      width: "24px",
                      height: "24px",
                      border: "3px solid #EFF6FF",
                      borderTopColor: "#1E3A8A",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <div style={{ marginTop: "8px", fontSize: "13px", color: "#64748B", fontWeight: 500 }}>
                    Loading data from server...
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={actionColCount} style={{ padding: "24px", textAlign: "center" }}>
                  <div
                    style={{
                      background: "#FEF2F2",
                      color: "#991B1B",
                      padding: "16px",
                      borderRadius: "10px",
                      display: "inline-flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      maxWidth: "480px",
                    }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>{error}</div>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          background: "#DC2626",
                          color: "#FFFFFF",
                          border: "none",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Retry Loading
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={actionColCount}
                  style={{ padding: "32px", textAlign: "center", color: "#94A3B8" }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => {
                const isLastRow = idx === pageData.length - 1;
                return (
                <tr
                  key={idx}
                  onClick={(e) => handleRowClick(e, row)}
                  style={{
                    borderBottom: "1px solid #F1F5F9",
                    transition: "background 0.15s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                >
                  {columns.map((col, ci) => {
                    const rawVal = (row as Record<string, any>)[col.key];
                    let content: React.ReactNode = String(rawVal ?? "");

                    if (col.render) {
                      content = col.render(rawVal, row);
                    } else if (col.key === "status" || col.key === "state" || col.key === "condition") {
                      content = renderStatusBadge(String(rawVal ?? ""));
                    } else if (
                      typeof rawVal === "string" &&
                      (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(rawVal) ||
                        /created|updated|scanned|date|time|timestamp/i.test(col.key))
                    ) {
                      content = formatDateTime(rawVal);
                    }

                    const rawText = String(rawVal ?? "");
                    const keepNaturalWidth = rawText.length > 0 && rawText.length <= 32;

                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: "14px 16px",
                          color: "#0F172A",
                          verticalAlign: "middle",
                          borderBottom: "1px solid #F1F5F9",
                          whiteSpace: keepNaturalWidth ? "nowrap" : "normal",
                          borderBottomLeftRadius: isLastRow && ci === 0 ? "11px" : 0,
                          borderBottomRightRadius:
                            isLastRow && !showRowActions && ci === columns.length - 1
                              ? "11px"
                              : 0,
                        }}
                      >
                        {content}
                      </td>
                    );
                  })}
                  {showRowActions && (
                    <td
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: "14px 16px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                        borderBottom: "1px solid #F1F5F9",
                        borderBottomRightRadius: isLastRow ? "11px" : 0,
                      }}
                    >
                      {renderRowActions && renderRowActions(row)}
                    </td>
                  )}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!hidePagination && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748B" }}>
            <span>
              Showing <strong>{totalRecords > 0 ? (activePage - 1) * pageSize + 1 : 0}</strong> to{" "}
              <strong>{Math.min(activePage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong> records
            </span>
            <span style={{ color: "#CBD5E1" }}>•</span>
            <span>
              Page <strong>{activePage}</strong> of <strong>{totalPages}</strong>
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => goToPage(Math.max(1, activePage - 1))}
              disabled={activePage === 1}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                minHeight: "44px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: activePage === 1 ? "#F1F5F9" : "#FFFFFF",
                color: activePage === 1 ? "#94A3B8" : "#0F172A",
                fontSize: "13px",
                fontWeight: 600,
                cursor: activePage === 1 ? "not-allowed" : "pointer",
              }}
            >
              <FaChevronLeft size={11} /> Previous
            </button>

            <button
              onClick={() => goToPage(Math.min(totalPages, activePage + 1))}
              disabled={activePage === totalPages}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                minHeight: "44px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: activePage === totalPages ? "#F1F5F9" : "#FFFFFF",
                color: activePage === totalPages ? "#94A3B8" : "#0F172A",
                fontSize: "13px",
                fontWeight: 600,
                cursor: activePage === totalPages ? "not-allowed" : "pointer",
              }}
            >
              Next <FaChevronRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* View / Edit Modal */}
      {selectedRow && modalMode && (
        <Modal
          isOpen={true}
          onClose={() => {
            setModalMode(null);
            setSelectedRow(null);
          }}
          title={modalMode === "view" ? `View Details - ${selectedRow.name || selectedRow.title || selectedRow.id || "Record"}` : `Edit Record - ${selectedRow.name || selectedRow.title || selectedRow.id || "Record"}`}
          maxWidth="600px"
          footer={
            modalMode === "view" ? (
              (canEdit || canDelete) ? (
                <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}>
                  {canEdit && (
                    <button
                      onClick={handleStartEdit}
                      style={{
                        background: "#1E3A8A",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "9px 18px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaEdit /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      style={{
                        background: "#DC2626",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "9px 18px",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaTrash /> Delete
                    </button>
                  )}
                </div>
              ) : undefined
            ) : (
              <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}>
                <button
                  onClick={handleSaveChanges}
                  style={{
                    background: "#16A34A",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaSave /> Save Changes
                </button>
                <button
                  onClick={() => setModalMode("view")}
                  style={{
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "1px solid #CBD5E1",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )
          }
        >
          {modalMode === "view" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {Object.entries(selectedRow).map(([key, val]) => (
                <div key={key} style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "10px", border: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                    {formatLabel(key)}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", wordBreak: "break-word" }}>
                    {key === "status" || key === "state" || key === "condition"
                      ? renderStatusBadge(String(val ?? ""))
                      : String(val ?? "-")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {columns.map((col) => (
                <div key={col.key}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    {col.title || col.header || col.key}
                  </label>
                  <input
                    type="text"
                    value={String(editFormData[col.key] ?? "")}
                    onChange={(e) => setEditFormData({ ...editFormData, [col.key]: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsDeleteConfirmOpen(false)}
          title={`Confirm Record Deletion: ${selectedRow?.name || selectedRow?.title || selectedRow?.id || "Record"}`}
          maxWidth="450px"
          footer={
            <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}>
              <button
                onClick={handleConfirmDelete}
                style={{
                  background: "#DC2626",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Delete Record
              </button>
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          }
        >
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <FaExclamationTriangle size={36} style={{ color: "#DC2626", marginBottom: "12px" }} />
            <h4 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Delete Record Confirmation
            </h4>
            <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{selectedRow?.name || selectedRow?.title || selectedRow?.id || "this record"}</strong>? This operation will remove the entry from active databases.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DataTable;