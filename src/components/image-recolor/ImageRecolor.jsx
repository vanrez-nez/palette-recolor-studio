import * as Slider from "@radix-ui/react-slider";
import { SlidersHorizontal } from "lucide-react";
import { ImagePreview } from "../image-preview/ImagePreview.jsx";
import { SettingSelect } from "../common/SettingSelect.jsx";
import { DISTANCE_OPTIONS, IMAGE_QUANTIZER_OPTIONS } from "../../utils/constants.js";

export function ImageRecolor({
  activeWorkspaceColors,
  canvasRef,
  canPanPreview,
  dragging,
  isPreviewPanning,
  isRecoloring,
  onDrop,
  onImportTargetFile,
  onPreviewPanMove,
  onPreviewPanStart,
  onPreviewPanStop,
  onPreviewWheel,
  onResetZoom,
  onSaveRecoloredImage,
  onSetActualSize,
  onShowOriginalChange,
  onUpdateRecolorSetting,
  onZoom,
  previewPan,
  previewStackRef,
  previewZoom,
  recolorProgress,
  recolorSettings,
  recolorStrength,
  showOriginal,
  targetError,
  targetImage,
  targetImageInputRef,
}) {
  return (
    <section className="main-stage">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Recolor Image</h2>
            <p>Upload an image and tune how the workspace swatch is applied.</p>
          </div>
        </div>

        <div className="recolor-layout">
          <div className="settings-panel">
            <div className="settings-title">
              <SlidersHorizontal aria-hidden="true" size={18} />
              <h3>Apply Settings</h3>
            </div>
            <label>
              Image quantizer
              <SettingSelect
                ariaLabel="Recolor image quantizer"
                value={recolorSettings.imageQuantization}
                options={IMAGE_QUANTIZER_OPTIONS}
                onValueChange={(value) => onUpdateRecolorSetting("imageQuantization", value)}
              />
            </label>
            <label>
              Distance
              <SettingSelect
                ariaLabel="Recolor color distance"
                value={recolorSettings.colorDistanceFormula}
                options={DISTANCE_OPTIONS}
                onValueChange={(value) => onUpdateRecolorSetting("colorDistanceFormula", value)}
              />
            </label>
            <label>
              Strength
              <Slider.Root
                className="setting-slider-root"
                value={[recolorStrength]}
                min={0}
                max={100}
                step={1}
                onValueChange={([value]) => onUpdateRecolorSetting("strength", value)}
              >
                <Slider.Track className="setting-slider-track">
                  <Slider.Range className="setting-slider-range" />
                </Slider.Track>
                <Slider.Thumb className="setting-slider-thumb" aria-label="Recolor strength" />
              </Slider.Root>
              <output>{recolorStrength}%</output>
            </label>
          </div>

          <div className="preview-panel">
            <ImagePreview
              activeWorkspaceColors={activeWorkspaceColors}
              canvasRef={canvasRef}
              canPanPreview={canPanPreview}
              dragging={dragging}
              isPreviewPanning={isPreviewPanning}
              isRecoloring={isRecoloring}
              onDrop={onDrop}
              onImportTargetFile={onImportTargetFile}
              onPreviewPanMove={onPreviewPanMove}
              onPreviewPanStart={onPreviewPanStart}
              onPreviewPanStop={onPreviewPanStop}
              onPreviewWheel={onPreviewWheel}
              onResetZoom={onResetZoom}
              onSaveRecoloredImage={onSaveRecoloredImage}
              onSetActualSize={onSetActualSize}
              onShowOriginalChange={onShowOriginalChange}
              onZoom={onZoom}
              previewPan={previewPan}
              previewStackRef={previewStackRef}
              previewZoom={previewZoom}
              recolorProgress={recolorProgress}
              showOriginal={showOriginal}
              targetImage={targetImage}
              targetImageInputRef={targetImageInputRef}
            />
            {targetError && <div className="status error">{targetError}</div>}
          </div>
        </div>
      </section>
    </section>
  );
}
