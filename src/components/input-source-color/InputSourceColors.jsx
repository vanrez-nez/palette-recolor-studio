import * as RadioGroup from "@radix-ui/react-radio-group";
import { FileImage, FileUp } from "lucide-react";
import { ColorSwatch } from "../common/ColorSwatch.jsx";
import { CollapsiblePanel } from "../common/CollapsiblePanel.jsx";
import { SettingSelect } from "../common/SettingSelect.jsx";
import { DISTANCE_OPTIONS, PALETTE_QUANTIZER_OPTIONS } from "../../utils/constants.js";
import { sourceImportLabel } from "../../utils/files.js";

export function InputSourceColors({
  activeImport,
  activeImportSwatchId,
  activeSource,
  dragging,
  error,
  extractSettings,
  imageError,
  isExpanded,
  onAddAll,
  onAddColor,
  onDrop,
  onExpandedChange,
  onImageFile,
  onPaletteFile,
  onSourceChange,
  onUpdateExtractSetting,
  onUpdateSwatchView,
  sourceImagePreview,
  sourceImageReference,
  swatchView,
  workspaceColorKeys,
}) {
  return (
    <CollapsiblePanel
      title="Import Source Colors"
      subtitle="Choose colors to add into the workspace swatch."
      expanded={isExpanded}
      onExpandedChange={onExpandedChange}
    >
      <RadioGroup.Root
        className="tab-switcher"
        value={activeSource}
        onValueChange={onSourceChange}
        orientation="horizontal"
        aria-label="Source type"
      >
        <RadioGroup.Item className="tab-option" value="palette">
          <RadioGroup.Indicator className="tab-indicator" />
          <FileUp aria-hidden="true" size={17} />
          <span>AFPalette</span>
        </RadioGroup.Item>
        <RadioGroup.Item className="tab-option" value="image">
          <RadioGroup.Indicator className="tab-indicator" />
          <FileImage aria-hidden="true" size={17} />
          <span>Image</span>
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
      ) : (
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
