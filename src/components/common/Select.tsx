import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown, FaSearch, FaCheck, FaTimes } from "react-icons/fa";

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    color?: string;
    bg?: string;
  };
}

export interface SelectProps<T = string | number> {
  options: Array<SelectOption<T> | string | number>;
  value?: T;
  onChange?: (value: T, option?: SelectOption<T>) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  size?: "sm" | "md" | "lg";
  id?: string;
  name?: string;
  autoFocus?: boolean;
}

export const Select = <T extends string | number = string>({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  label,
  helperText,
  error,
  disabled = false,
  required = false,
  searchable,
  clearable = false,
  className = "",
  style,
  containerStyle,
  size = "md",
  id,
  name,
}: SelectProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
  }>({
    top: 0,
    left: 0,
    width: 0,
    placement: "bottom",
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  // Normalize options to SelectOption objects
  const normalizedOptions = useMemo<SelectOption<T>[]>(() => {
    return options.map((opt) => {
      if (opt !== null && typeof opt === "object" && "value" in opt) {
        return opt as SelectOption<T>;
      }
      return {
        value: opt as unknown as T,
        label: String(opt),
      };
    });
  }, [options]);

  // Selected option lookup
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === "") return null;
    return normalizedOptions.find((opt) => String(opt.value) === String(value)) || null;
  }, [normalizedOptions, value]);

  // Determine if search is active
  const isSearchActive = useMemo(() => {
    if (searchable !== undefined) return searchable;
    return normalizedOptions.length >= 7;
  }, [searchable, normalizedOptions.length]);

  // Filtered options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const lower = searchTerm.toLowerCase();
    return normalizedOptions.filter((opt) => {
      return (
        opt.label.toLowerCase().includes(lower) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(lower)) ||
        String(opt.value).toLowerCase().includes(lower)
      );
    });
  }, [normalizedOptions, searchTerm]);

  // Calculate dropdown positioning relative to the viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const menuHeight = Math.min(280, Math.max(120, filteredOptions.length * 36 + (isSearchActive ? 46 : 10)));
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement: "bottom" | "top" = "bottom";
    let top = rect.bottom + 4;

    if (spaceBelow < menuHeight + 10 && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - menuHeight - 4;
    }

    // Keep horizontally within viewport boundaries
    let left = rect.left;
    const menuWidth = Math.max(rect.width, 160);
    if (left + menuWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - menuWidth - 12);
    }

    setMenuCoords({
      top: Math.max(8, top),
      left: Math.max(8, left),
      width: menuWidth,
      placement,
    });
  }, [filteredOptions.length, isSearchActive]);

  // Open / Close Handlers
  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setSearchTerm("");
    const selectedIdx = filteredOptions.findIndex((opt) => String(opt.value) === String(value));
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchTerm("");
  }, []);

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return;
      if (onChange) {
        onChange(option.value, option);
      }
      handleClose();
      triggerRef.current?.focus();
    },
    [onChange, handleClose]
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) {
      onChange("" as unknown as T);
    }
  };

  // Recalculate position on resize or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("touchstart", handleMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("touchstart", handleMouseDown);
    };
  }, [isOpen, handleClose]);

  // Focus search input when menu opens
  useEffect(() => {
    if (isOpen && isSearchActive && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isSearchActive]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        handleClose();
        triggerRef.current?.focus();
        break;

      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev + 1;
          while (next < filteredOptions.length && filteredOptions[next]?.disabled) {
            next++;
          }
          return next < filteredOptions.length ? next : prev;
        });
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && filteredOptions[next]?.disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        break;

      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;

      case "Tab":
        handleClose();
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !optionsContainerRef.current) return;
    const container = optionsContainerRef.current;
    const highlightedEl = container.children[highlightedIndex] as HTMLElement | undefined;
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  // Sizing Styles
  const sizeStyles = {
    sm: { height: 32, fontSize: "12.5px", padding: "4px 10px" },
    md: { height: 40, fontSize: "13.5px", padding: "8px 12px" },
    lg: { height: 46, fontSize: "14.5px", padding: "10px 14px" },
  }[size];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        width: "100%",
        position: "relative",
        boxSizing: "border-box",
        ...containerStyle,
      }}
      className={`pg-select-wrapper ${className}`}
    >
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: error ? "#DC2626" : "#334155",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {label}
          {required && <span style={{ color: "#DC2626" }}>*</span>}
        </label>
      )}

      {/* Hidden Native Input for form compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value !== undefined && value !== null ? String(value) : ""}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minHeight: sizeStyles.height,
          padding: sizeStyles.padding,
          fontSize: sizeStyles.fontSize,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          background: disabled ? "#F8FAFC" : "#FFFFFF",
          border: `1px solid ${error ? "#EF4444" : isOpen ? "#1E3A8A" : "#CBD5E1"}`,
          borderRadius: "8px",
          color: selectedOption ? "#0F172A" : "#94A3B8",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          boxShadow: isOpen ? "0 0 0 3px rgba(30, 58, 138, 0.12)" : "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
          textAlign: "left",
          boxSizing: "border-box",
          ...style,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            color: selectedOption ? "#0F172A" : "#94A3B8",
            fontWeight: selectedOption ? 500 : 400,
          }}
        >
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "4px",
                background: selectedOption.badge.bg || "#EFF6FF",
                color: selectedOption.badge.color || "#1E3A8A",
                marginLeft: "4px",
                flexShrink: 0,
              }}
            >
              {selectedOption.badge.text}
            </span>
          )}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, color: "#64748B" }}>
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              style={{
                cursor: "pointer",
                padding: "2px",
                display: "inline-flex",
                alignItems: "center",
                color: "#94A3B8",
                borderRadius: "4px",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
            >
              <FaTimes size={11} />
            </span>
          )}
          <FaChevronDown
            size={11}
            style={{
              transition: "transform 0.2s ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              color: isOpen ? "#1E3A8A" : "#94A3B8",
            }}
          />
        </div>
      </button>

      {/* Helper text or Error message */}
      {error ? (
        <span style={{ fontSize: "11.5px", color: "#DC2626", fontWeight: 500 }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: "11.5px", color: "#64748B" }}>{helperText}</span>
      ) : null}

      {/* Portal Dropdown Menu */}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: menuCoords.top,
              left: menuCoords.left,
              width: menuCoords.width,
              maxHeight: "280px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.08)",
              zIndex: 999999,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: menuCoords.placement === "bottom" ? "slideDown 0.15s ease-out" : "fadeIn 0.15s ease-out",
              boxSizing: "border-box",
            }}
          >
            {/* Search Input Filter */}
            {isSearchActive && (
              <div
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexShrink: 0,
                }}
              >
                <FaSearch size={12} style={{ color: "#94A3B8", flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type to filter options..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    fontSize: "12.5px",
                    outline: "none",
                    color: "#0F172A",
                    padding: "2px 0",
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#94A3B8",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <FaTimes size={10} />
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div
              ref={optionsContainerRef}
              style={{
                overflowY: "auto",
                maxHeight: isSearchActive ? "230px" : "270px",
                padding: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {filteredOptions.length === 0 ? (
                <div
                  style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    color: "#64748B",
                    fontSize: "12.5px",
                  }}
                >
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((option, idx) => {
                  const isSelected = String(option.value) === String(value);
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={String(option.value) + idx}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        cursor: option.disabled ? "not-allowed" : "pointer",
                        background: isSelected
                          ? "#EFF6FF"
                          : isHighlighted
                          ? "#F1F5F9"
                          : "transparent",
                        color: option.disabled
                          ? "#94A3B8"
                          : isSelected
                          ? "#1E3A8A"
                          : "#0F172A",
                        fontWeight: isSelected ? 600 : 400,
                        transition: "background-color 0.1s ease",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                        {option.icon && (
                          <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                            {option.icon}
                          </span>
                        )}
                        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {option.label}
                          </span>
                          {option.sublabel && (
                            <span style={{ fontSize: "11px", color: "#64748B" }}>
                              {option.sublabel}
                            </span>
                          )}
                        </div>
                        {option.badge && (
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: option.badge.bg || "#EFF6FF",
                              color: option.badge.color || "#1E3A8A",
                              marginLeft: "4px",
                              flexShrink: 0,
                            }}
                          >
                            {option.badge.text}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <FaCheck size={11} style={{ color: "#2563EB", flexShrink: 0, marginLeft: "6px" }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Select;
