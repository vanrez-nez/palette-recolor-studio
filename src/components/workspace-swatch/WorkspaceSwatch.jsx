import { Trash2 } from "lucide-react";
import { ColorSwatch } from "../common/ColorSwatch.jsx";
import { CollapsiblePanel } from "../common/CollapsiblePanel.jsx";

export function WorkspaceSwatch({
  colors,
  isExpanded,
  onClear,
  onClearUnselected,
  onColorRemove,
  onColorToggle,
  onExpandedChange,
  onSortColors,
  onUpdateSwatchView,
  swatchView,
}) {
  return (
    <CollapsiblePanel
      title="Workspace Swatch"
      expanded={isExpanded}
      onExpandedChange={onExpandedChange}
      actions={
        colors.length > 0 && (
          <button
            className="icon-button panel-action"
            type="button"
            title="Clear workspace swatch"
            aria-label="Clear workspace swatch"
            onClick={onClear}
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        )
      }
    >
      {colors.length ? (
        <ColorSwatch
          colors={colors}
          removable
          selectable
          view={swatchView}
          onViewChange={onUpdateSwatchView}
          onClearUnselected={onClearUnselected}
          onColorToggle={onColorToggle}
          onColorRemove={onColorRemove}
          onSortColors={onSortColors}
        />
      ) : (
        <div className="empty-panel">No workspace colors selected.</div>
      )}
    </CollapsiblePanel>
  );
}
