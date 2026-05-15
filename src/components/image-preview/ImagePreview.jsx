import { Download, Eye, ImagePlus, RotateCcw, Scaling, ZoomIn, ZoomOut } from "lucide-react";
import { FloatingBar } from "../common/FloatingBar.jsx";
import { TooltipButton } from "../common/TooltipButton.jsx";
import { formatFileSize } from "../../utils/files.js";

export function ImagePreview({
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
  onZoom,
  previewPan,
  previewStackRef,
  previewZoom,
  recolorProgress,
  showOriginal,
  targetImage,
  targetImageInputRef,
}) {
  return (
    <div
      className={`dropzone target-dropzone preview-dropzone ${dragging === "target" ? "dragging" : ""} ${
        targetImage ? "has-image" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        onDrop.setDragging("target");
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => onDrop.setDragging("")}
      onDrop={(event) => onDrop.handle(event, "target")}
      onClick={() => {
        if (!targetImage) targetImageInputRef.current?.click();
      }}
    >
      <input
        ref={targetImageInputRef}
        className="hidden-file-input"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(event) => {
          onImportTargetFile(event.target.files[0]);
          event.target.value = "";
        }}
      />
      <FloatingBar ariaLabel="Image actions" className="preview-image-actions" orientation="horizontal">
        <TooltipButton
          type="button"
          aria-label="Save recolored image"
          tooltip="Save recolored image"
          disabled={!targetImage || !activeWorkspaceColors.length}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSaveRecoloredImage();
          }}
        >
          <Download aria-hidden="true" size={15} />
        </TooltipButton>
        <TooltipButton
          type="button"
          aria-label="Load different image"
          tooltip="Load different image"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            targetImageInputRef.current?.click();
          }}
        >
          <ImagePlus aria-hidden="true" size={15} />
        </TooltipButton>
      </FloatingBar>
      {targetImage ? (
        <>
          <div className="preview-filebar">
            {targetImage.fileName} ({targetImage.width}x{targetImage.height} - {formatFileSize(targetImage.fileSize)})
          </div>
          <div
            ref={previewStackRef}
            className={`preview-stack ${canPanPreview ? "can-pan" : ""} ${isPreviewPanning ? "is-panning" : ""}`}
            onPointerDown={onPreviewPanStart}
            onPointerMove={onPreviewPanMove}
            onPointerUp={onPreviewPanStop}
            onPointerCancel={onPreviewPanStop}
            onWheel={onPreviewWheel}
          >
            <div
              className="preview-viewport-content"
              style={{
                "--preview-image-aspect": `${targetImage.width} / ${targetImage.height}`,
                "--preview-fit-width": `${68 * (targetImage.width / targetImage.height)}vh`,
                transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
              }}
            >
              <canvas ref={canvasRef} className={`preview-canvas ${activeWorkspaceColors.length ? "" : "hidden-canvas"}`} />
              <img
                className={`preview-canvas original-preview ${
                  activeWorkspaceColors.length && !showOriginal ? "hidden-original" : ""
                }`}
                src={targetImage.url}
                alt=""
              />
              {isRecoloring && (
                <div className="recolor-progress-overlay" style={{ transform: `scaleX(${recolorProgress / 100})` }} />
              )}
            </div>
          </div>
          <FloatingBar ariaLabel="Image zoom controls" className="preview-zoom-controls" orientation="vertical">
            {activeWorkspaceColors.length > 0 && (
              <TooltipButton
                className="hold-original-button"
                type="button"
                aria-label="Hold to show original"
                tooltip="Hold to show original"
                onClick={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onShowOriginalChange(true);
                }}
                onPointerUp={() => onShowOriginalChange(false)}
                onPointerCancel={() => onShowOriginalChange(false)}
                onPointerLeave={() => onShowOriginalChange(false)}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") onShowOriginalChange(true);
                }}
                onKeyUp={() => onShowOriginalChange(false)}
              >
                <Eye aria-hidden="true" size={15} />
              </TooltipButton>
            )}
            <TooltipButton type="button" aria-label="Zoom in" tooltip="Zoom in" onClick={(event) => onZoom(event, 0.25)}>
              <ZoomIn aria-hidden="true" size={15} />
            </TooltipButton>
            <TooltipButton
              type="button"
              aria-label="Zoom out"
              tooltip="Zoom out"
              disabled={previewZoom === 1}
              onClick={(event) => onZoom(event, -0.25)}
            >
              <ZoomOut aria-hidden="true" size={15} />
            </TooltipButton>
            <TooltipButton
              type="button"
              aria-label="Set image to actual size"
              tooltip="Set image to actual size"
              disabled={!targetImage}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSetActualSize();
              }}
            >
              <Scaling aria-hidden="true" size={15} />
            </TooltipButton>
            <TooltipButton
              type="button"
              aria-label="Reset zoom"
              tooltip="Reset zoom"
              disabled={previewZoom === 1 && previewPan.x === 0 && previewPan.y === 0}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResetZoom();
              }}
            >
              <RotateCcw aria-hidden="true" size={14} />
            </TooltipButton>
          </FloatingBar>
          {!activeWorkspaceColors.length && <div className="preview-hint">Add workspace colors to recolor this image.</div>}
        </>
      ) : (
        <button className="preview-empty" type="button">
          <ImagePlus aria-hidden="true" size={30} />
          <span>Drop the image to recolor</span>
        </button>
      )}
    </div>
  );
}
