import { Check, ChevronRight, MoreHorizontal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COLOR_SORT_GROUPS } from "../../utils/colorSorting.js";

const SIZE_OPTIONS = ["small", "medium", "large"];
const FORMAT_OPTIONS = ["hex", "rgb"];
const MENU_WIDTH = 224;
const SORT_MENU_WIDTH = 264;
const VIEWPORT_PADDING = 8;
export const DEFAULT_SWATCH_VIEW = {
  isList: false,
  size: "small",
  format: "hex",
};

function formatColor(color, format) {
  if (format === "rgb") {
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }

  return color.hex;
}

function colorCountLabel(count) {
  return `${count} ${count === 1 ? "Color" : "Colors"}`;
}

function colorHint(color) {
  if (!color.name || color.name.toLowerCase() === color.hex.toLowerCase()) {
    return color.hex;
  }

  return `${color.name} ${color.hex}`;
}

function MenuCheck({ checked }) {
  return (
    <span className="color-swatch-menu-check" aria-hidden="true">
      {checked && <Check size={12} />}
    </span>
  );
}

function getMenuPosition(trigger) {
  const rect = trigger.getBoundingClientRect();
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING);
  const left = Math.min(Math.max(VIEWPORT_PADDING, rect.right - MENU_WIDTH), maxLeft);

  return {
    left,
    top: rect.bottom + 6,
  };
}

function getSortMenuPosition(trigger, menuHeight = 520) {
  const rect = trigger.getBoundingClientRect();
  const opensLeft = rect.right + 7 + SORT_MENU_WIDTH > window.innerWidth - VIEWPORT_PADDING;
  const rawLeft = opensLeft ? rect.left - SORT_MENU_WIDTH - 7 : rect.right + 7;
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - SORT_MENU_WIDTH - VIEWPORT_PADDING);
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - menuHeight - VIEWPORT_PADDING);

  return {
    left: Math.min(Math.max(VIEWPORT_PADDING, rawLeft), maxLeft),
    top: Math.min(Math.max(VIEWPORT_PADDING, rect.top - 6), maxTop),
  };
}

export function ColorSwatch({
  colors,
  getColorKey = (color) => color.hex,
  onClearUnselected,
  onColorClick,
  onColorRemove,
  onColorToggle,
  onSortColors,
  onViewChange,
  removable = false,
  selectable = false,
  selectedColorKeys,
  showToolbar = true,
  view = DEFAULT_SWATCH_VIEW,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [sortMenuPosition, setSortMenuPosition] = useState(null);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const popoverRef = useRef(null);
  const sortMenuTriggerRef = useRef(null);
  const sortPopoverRef = useRef(null);
  const sortCloseTimerRef = useRef(null);
  const isList = view.isList ?? DEFAULT_SWATCH_VIEW.isList;
  const size = view.size ?? DEFAULT_SWATCH_VIEW.size;
  const format = view.format ?? DEFAULT_SWATCH_VIEW.format;
  const activeCount = selectable ? colors.filter((color) => color.enabled !== false).length : colors.length;
  const selectedKeySet = selectedColorKeys ? new Set(selectedColorKeys) : null;
  const title = selectable ? `${activeCount}/${colorCountLabel(colors.length)}` : colorCountLabel(colors.length);
  const hasUnselectedColors = selectable && colors.some((color) => color.enabled === false);

  function updateView(nextView) {
    onViewChange?.({
      isList,
      size,
      format,
      ...nextView,
    });
  }

  function activateColor(color) {
    if (selectable) {
      onColorToggle?.(color);
      return;
    }
    onColorClick?.(color);
  }

  function handleColorKeyDown(event, color) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    activateColor(color);
  }

  function openMenu() {
    if (menuButtonRef.current) {
      setMenuPosition(getMenuPosition(menuButtonRef.current));
    }
    setIsMenuOpen(true);
  }

  function closeMenu() {
    setIsMenuOpen(false);
    setIsSortMenuOpen(false);
  }

  function openSortMenu() {
    if (sortCloseTimerRef.current) {
      window.clearTimeout(sortCloseTimerRef.current);
    }
    if (sortMenuTriggerRef.current) {
      setSortMenuPosition(getSortMenuPosition(sortMenuTriggerRef.current, sortPopoverRef.current?.offsetHeight));
    }
    setIsSortMenuOpen(true);
  }

  function scheduleSortMenuClose() {
    if (sortCloseTimerRef.current) {
      window.clearTimeout(sortCloseTimerRef.current);
    }
    sortCloseTimerRef.current = window.setTimeout(() => setIsSortMenuOpen(false), 140);
  }

  useEffect(() => {
    function handleDocumentClick(event) {
      if (
        !menuRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target) &&
        !sortPopoverRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handleDocumentClick);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentClick);
      if (sortCloseTimerRef.current) {
        window.clearTimeout(sortCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function updatePosition() {
      if (menuButtonRef.current) {
        setMenuPosition(getMenuPosition(menuButtonRef.current));
      }
      if (sortMenuTriggerRef.current) {
        setSortMenuPosition(getSortMenuPosition(sortMenuTriggerRef.current, sortPopoverRef.current?.offsetHeight));
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isMenuOpen]);

  useLayoutEffect(() => {
    if (!isMenuOpen || !popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - rect.height - VIEWPORT_PADDING);
    const nextTop = Math.min(Math.max(VIEWPORT_PADDING, rect.top), maxTop);
    if (Math.abs(nextTop - rect.top) > 0.5) {
      setMenuPosition((position) => (position ? { ...position, top: nextTop } : position));
    }
  }, [isMenuOpen, menuPosition]);

  useLayoutEffect(() => {
    if (!isSortMenuOpen || !sortPopoverRef.current || !sortMenuTriggerRef.current) return;
    setSortMenuPosition(getSortMenuPosition(sortMenuTriggerRef.current, sortPopoverRef.current.offsetHeight));
  }, [isSortMenuOpen]);

  return (
    <div className={`color-swatch ${showToolbar ? "" : "compact"}`}>
      {showToolbar && (
        <div className="color-swatch-toolbar">
          <strong className="color-swatch-title">{title}</strong>
          <div className="color-swatch-menu" ref={menuRef}>
          <button
            ref={menuButtonRef}
            className="icon-button color-swatch-menu-button"
            type="button"
            title="Swatch view"
            aria-label="Swatch view"
            aria-expanded={isMenuOpen}
            onClick={() => {
              if (isMenuOpen) {
                closeMenu();
              } else {
                openMenu();
              }
            }}
          >
            <MoreHorizontal aria-hidden="true" size={16} />
          </button>
          {isMenuOpen &&
            menuPosition &&
            createPortal(
              <div
                ref={popoverRef}
                className="color-swatch-menu-surface color-swatch-menu-popover"
                role="menu"
                style={{
                  left: `${menuPosition.left}px`,
                  top: `${menuPosition.top}px`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
              <button
                className={isList ? "selected" : ""}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isList}
                onClick={() => updateView({ isList: !isList })}
              >
                <MenuCheck checked={isList} />
                List
              </button>
              <span className="menu-separator" aria-hidden="true" />
              {SIZE_OPTIONS.map((option) => (
                <button
                  className={size === option ? "selected" : ""}
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={size === option}
                  onClick={() => {
                    updateView({ size: option });
                    closeMenu();
                  }}
                >
                  <MenuCheck checked={size === option} />
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
              <span className="menu-separator" aria-hidden="true" />
              {FORMAT_OPTIONS.map((option) => (
                <button
                  className={format === option ? "selected" : ""}
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={format === option}
                  onClick={() => {
                    updateView({ format: option });
                    closeMenu();
                  }}
                >
                  <MenuCheck checked={format === option} />
                  {option.toUpperCase()}
                </button>
              ))}
              {onClearUnselected && (
                <>
                  <span className="menu-separator" aria-hidden="true" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!hasUnselectedColors}
                    onClick={() => {
                      onClearUnselected();
                      closeMenu();
                    }}
                  >
                    <MenuCheck checked={false} />
                    Clear Unselected
                  </button>
                </>
              )}
              {onSortColors && (
                <>
                  <span className="menu-separator" aria-hidden="true" />
                  <div className="color-swatch-submenu">
                    <button
                      ref={sortMenuTriggerRef}
                      className="color-swatch-submenu-trigger"
                      type="button"
                      role="menuitem"
                      aria-expanded={isSortMenuOpen}
                      onClick={openSortMenu}
                      onFocus={openSortMenu}
                      onPointerEnter={openSortMenu}
                      onPointerLeave={scheduleSortMenuClose}
                    >
                      <span aria-hidden="true" />
                      <span className="color-swatch-submenu-label">Re-sort</span>
                      <ChevronRight className="color-swatch-submenu-icon" aria-hidden="true" size={13} />
                    </button>
                  </div>
                </>
              )}
              </div>,
              document.body,
            )}
          {isMenuOpen &&
            isSortMenuOpen &&
            sortMenuPosition &&
            createPortal(
              <div
                ref={sortPopoverRef}
                className="color-swatch-menu-surface color-swatch-submenu-popover"
                role="menu"
                style={{
                  left: `${sortMenuPosition.left}px`,
                  top: `${sortMenuPosition.top}px`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerEnter={openSortMenu}
                onPointerLeave={scheduleSortMenuClose}
              >
                {COLOR_SORT_GROUPS.map((group) => (
                  <div className="color-swatch-sort-group" key={group.label} role="group" aria-label={group.label}>
                    <span className="color-swatch-sort-group-title">{group.label}</span>
                    {group.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSortColors(option.value);
                          closeMenu();
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>,
              document.body,
            )}
          </div>
        </div>
      )}

      <div className={`color-swatch-content ${isList ? "list" : "grid"} ${size}`}>
        {colors.map((color) => {
          const disabled = selectable && color.enabled === false;
          const selected = selectedKeySet?.has(getColorKey(color));
          return (
            <button
              className={`color-swatch-item ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
              key={color.id}
              type="button"
              onClick={() => activateColor(color)}
              onKeyDown={(event) => handleColorKeyDown(event, color)}
              title={colorHint(color)}
            >
              <span className="color-swatch-chip" style={{ backgroundColor: color.hex }} />
              {isList && (
                <span className="color-swatch-text">
                  <strong>{formatColor(color, format)}</strong>
                </span>
              )}
              {isList && removable && (
                <span
                  className="color-swatch-remove icon-button"
                  role="button"
                  tabIndex={0}
                  title="Remove color"
                  aria-label={`Remove ${color.hex}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onColorRemove?.(color);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      onColorRemove?.(color);
                    }
                  }}
                >
                  <X aria-hidden="true" size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
