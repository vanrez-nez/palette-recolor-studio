import { Check, MoreHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SIZE_OPTIONS = ["small", "medium", "large"];
const FORMAT_OPTIONS = ["hex", "rgb"];
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

function MenuCheck({ checked }) {
  return (
    <span className="color-swatch-menu-check" aria-hidden="true">
      {checked && <Check size={12} />}
    </span>
  );
}

export function ColorSwatch({
  colors,
  getColorKey = (color) => color.hex,
  onClearUnselected,
  onColorClick,
  onColorRemove,
  onColorToggle,
  onViewChange,
  removable = false,
  selectable = false,
  selectedColorKeys,
  view = DEFAULT_SWATCH_VIEW,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
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

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentClick);
    return () => document.removeEventListener("pointerdown", handleDocumentClick);
  }, []);

  return (
    <div className="color-swatch">
      <div className="color-swatch-toolbar">
        <strong className="color-swatch-title">{title}</strong>
        <div className="color-swatch-menu" ref={menuRef}>
          <button
            className="icon-button color-swatch-menu-button"
            type="button"
            title="Swatch view"
            aria-label="Swatch view"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <MoreHorizontal aria-hidden="true" size={16} />
          </button>
          {isMenuOpen && (
            <div className="color-swatch-menu-popover" role="menu">
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
                    setIsMenuOpen(false);
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
                    setIsMenuOpen(false);
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
                      setIsMenuOpen(false);
                    }}
                  >
                    <MenuCheck checked={false} />
                    Clear Unselected
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

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
              title={`${color.name} ${color.hex}`}
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
