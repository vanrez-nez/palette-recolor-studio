import * as RadioGroup from "@radix-ui/react-radio-group";
import { FileImage, FileUp, Plus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { ColorSwatch } from "../common/ColorSwatch.jsx";
import { CollapsiblePanel } from "../common/CollapsiblePanel.jsx";
import { SettingSelect } from "../common/SettingSelect.jsx";
import { BuiltInPaletteExplorer } from "./BuiltInPaletteExplorer.jsx";
import { DISTANCE_OPTIONS, PALETTE_QUANTIZER_OPTIONS } from "../../utils/constants.js";
import { sourceImportLabel } from "../../utils/files.js";

export function InputSourceColors({
  activeImport,
  activeImportSwatchId,
  activeSource,
  builtInPalettes,
  dragging,
  error,
  extractSettings,
  getSwatchView,
  imageError,
  isExpanded,
  onAddAll,
  onAddColor,
  onAddLoadedPalette,
  onDrop,
  onExpandedChange,
  onImageFile,
  onPaletteFile,
  onRemoveLoadedPalettes,
  onSortColors,
  onSourceChange,
  onUpdateExtractSetting,
  onUpdateSwatchView,
  sourceImagePreview,
  sourceImageReference,
  swatchView,
  workspaceColorKeys,
}) {
  const [isBuiltInManageMode, setIsBuiltInManageMode] = useState(false);
  const [selectedBuiltInPaletteIds, setSelectedBuiltInPaletteIds] = useState([]);
  const selectedBuiltInPaletteIdSet = new Set(selectedBuiltInPaletteIds);

  function toggleBuiltInPaletteSelection(paletteId) {
    setSelectedBuiltInPaletteIds((selectedIds) =>
      selectedIds.includes(paletteId) ? selectedIds.filter((id) => id !== paletteId) : [...selectedIds, paletteId],
    );
  }

  function removeSelectedBuiltInPalettes() {
    onRemoveLoadedPalettes(selectedBuiltInPaletteIds);
    setSelectedBuiltInPaletteIds([]);
    setIsBuiltInManageMode(false);
  }

  return (
    <CollapsiblePanel
      title="Import Source Colors"
      subtitle="Choose colors to add into the workspace swatch."
      expanded={isExpanded}
      onExpandedChange={onExpandedChange}
    >
      <RadioGroup.Root
        className="tab-switcher source-tabs"
        value={activeSource}
        onValueChange={onSourceChange}
        orientation="horizontal"
        aria-label="Source type"
      >
        <RadioGroup.Item className="tab-option" value="built-in">
          <RadioGroup.Indicator className="tab-indicator" />
          <span>Built-in Palettes</span>
        </RadioGroup.Item>
        <RadioGroup.Item className="tab-option" value="image">
          <RadioGroup.Indicator className="tab-indicator" />
          <span>Image</span>
        </RadioGroup.Item>
        <RadioGroup.Item className="tab-option" value="palette">
          <RadioGroup.Indicator className="tab-indicator" />
          <span>AFPalette</span>
        </RadioGroup.Item>
      </RadioGroup.Root>

      {activeSource === "palette" ? (
        <>
          <label
            className={`dropzone ${dragging === "palette" ? "dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              onDrop.setDragging("palette");
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => onDrop.setDragging("")}
            onDrop={(event) => onDrop.handle(event, "palette")}
          >
            <input type="file" accept=".afpalette" onChange={(event) => onPaletteFile(event.target.files[0])} />
            <FileUp aria-hidden="true" size={28} />
            <span>Drop an .afpalette file</span>
            <small>or click to choose one</small>
          </label>
          {error && <div className="status error">{error}</div>}
        </>
      ) : activeSource === "image" ? (
        <>
          <div className="settings-grid">
            <label>
              Colors
              <input
                type="number"
                min="2"
                max="32"
                value={extractSettings.colorLimit}
                onChange={(event) => onUpdateExtractSetting("colorLimit", event.target.value)}
              />
            </label>
            <label>
              Quantizer
              <SettingSelect
                ariaLabel="Image source quantizer"
                value={extractSettings.paletteQuantization}
                options={PALETTE_QUANTIZER_OPTIONS}
                onValueChange={(value) => onUpdateExtractSetting("paletteQuantization", value)}
              />
            </label>
            <label>
              Distance
              <SettingSelect
                ariaLabel="Image source color distance"
                value={extractSettings.colorDistanceFormula}
                options={DISTANCE_OPTIONS}
                onValueChange={(value) => onUpdateExtractSetting("colorDistanceFormula", value)}
              />
            </label>
          </div>
          <label
            className={`dropzone image-dropzone ${dragging === "image" ? "dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              onDrop.setDragging("image");
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => onDrop.setDragging("")}
            onDrop={(event) => onDrop.handle(event, "image")}
          >
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => onImageFile(event.target.files[0])} />
            {sourceImagePreview ? (
              <div className="dropzone-preview">
                <img src={sourceImagePreview.url} alt="" />
                <div>
                  <strong>{sourceImagePreview.fileName}</strong>
                  <small>Drop or click to replace source image</small>
                </div>
              </div>
            ) : (
              <>
                <FileImage aria-hidden="true" size={28} />
                <span>Drop a source image</span>
                <small>or click to extract colors</small>
              </>
            )}
          </label>
          {imageError && <div className="status error">{imageError}</div>}
        </>
      ) : (
        <div className="built-in-source-panel">
          <div className="built-in-toolbar">
            <BuiltInPaletteExplorer
              loadedPaletteIds={new Set(builtInPalettes.map((palette) => palette.id))}
              onLoadPalette={onAddLoadedPalette}
            />
            <button
              className="icon-button built-in-settings-button"
              type="button"
              title="Manage loaded palettes"
              aria-label="Manage loaded palettes"
              aria-pressed={isBuiltInManageMode}
              onClick={() => {
                setIsBuiltInManageMode((enabled) => !enabled);
                setSelectedBuiltInPaletteIds([]);
              }}
            >
              <Settings aria-hidden="true" size={14} />
            </button>
          </div>
          {builtInPalettes.length ? (
            <div className="built-in-loaded-list">
              {builtInPalettes.map((palette) => (
                <div className={`built-in-loaded-palette ${isBuiltInManageMode ? "manage" : ""}`} key={palette.id}>
                  {isBuiltInManageMode && (
                    <label className="built-in-palette-check">
                      <input
                        type="checkbox"
                        checked={selectedBuiltInPaletteIdSet.has(palette.id)}
                        onChange={() => toggleBuiltInPaletteSelection(palette.id)}
                      />
                      <span className="sr-only">Select {palette.name}</span>
                    </label>
                  )}
                  <ColorSwatch
                    colors={palette.colors}
                    selectedColorKeys={workspaceColorKeys}
                    view={getSwatchView(`built-in:${palette.id}`)}
                    onViewChange={(nextView) => onUpdateSwatchView(`built-in:${palette.id}`, nextView)}
                    onColorClick={(color) => onAddColor(color, palette)}
                    showToolbar={false}
                  />
                  {!isBuiltInManageMode && (
                    <button
                      className="ghost-action built-in-add-all"
                      type="button"
                      title="Add all colors"
                      aria-label={`Add all colors from ${palette.name}`}
                      onClick={() => palette.colors.forEach((color) => onAddColor(color, palette))}
                    >
                      <Plus aria-hidden="true" size={13} />
                    </button>
                  )}
                </div>
              ))}
              {isBuiltInManageMode && (
                <div className="built-in-list-actions">
                  <button
                    className="ghost-action danger"
                    type="button"
                    disabled={!selectedBuiltInPaletteIds.length}
                    onClick={removeSelectedBuiltInPalettes}
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    Remove
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-panel">No built-in palettes loaded.</div>
          )}
        </div>
      )}

      {activeImport && (
        <div className="source-result">
          <div className="result-header">
            <h3>{sourceImportLabel(activeImport, sourceImageReference ?? sourceImagePreview)}</h3>
          </div>
          <ColorSwatch
            colors={activeImport.colors}
            selectedColorKeys={workspaceColorKeys}
            view={swatchView}
            onViewChange={onUpdateSwatchView}
            onColorClick={(color) => onAddColor(color, activeImport)}
            onSortColors={onSortColors}
          />
          <div className="source-result-actions">
            <button className="ghost-action" type="button" onClick={onAddAll}>
              Add all
            </button>
          </div>
        </div>
      )}
    </CollapsiblePanel>
  );
}
