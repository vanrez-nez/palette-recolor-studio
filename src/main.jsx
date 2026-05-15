import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import {
  Check,
  Download,
  FileImage,
  FileUp,
  ChevronDown,
  FolderOpen,
  ImagePlus,
  MoreVertical,
  Save,
  Upload,
  RotateCcw,
  SlidersHorizontal,
  SwatchBook,
  Eye,
  Scaling,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { parseAFPalette } from "./afpalette.js";
import { ColorSwatch, DEFAULT_SWATCH_VIEW } from "./ColorSwatch.jsx";
import { extractImagePalette } from "./imagePalette.js";
import { drawSourceImageToCanvas, loadImageFile } from "./recolorImage.js";
import "./styles.css";

const DEFAULT_EXTRACT = {
  colorLimit: 12,
  paletteQuantization: "wuquant",
  colorDistanceFormula: "euclidean-bt709-noalpha",
};

const DEFAULT_RECOLOR = {
  imageQuantization: "nearest",
  colorDistanceFormula: "euclidean-bt709-noalpha",
  strength: 100,
  previewSize: 900,
};

const PALETTE_QUANTIZER_OPTIONS = [
  { value: "wuquant", label: "WuQuant" },
  { value: "rgbquant", label: "RGBQuant" },
  { value: "neuquant", label: "NeuQuant" },
  { value: "neuquant-float", label: "NeuQuant Float" },
];

const DISTANCE_OPTIONS = [
  { value: "euclidean-bt709-noalpha", label: "BT.709" },
  { value: "euclidean", label: "Euclidean" },
  { value: "manhattan-bt709", label: "Manhattan" },
  { value: "ciede2000", label: "CIEDE2000" },
  { value: "pngquant", label: "PNGQuant" },
];

const IMAGE_QUANTIZER_OPTIONS = [
  { value: "nearest", label: "Nearest color" },
  { value: "floyd-steinberg", label: "Floyd-Steinberg" },
  { value: "atkinson", label: "Atkinson" },
  { value: "sierra-lite", label: "Sierra Lite" },
  { value: "riemersma", label: "Riemersma" },
];

const STORAGE_KEY = "palette-recolor-studio-state-v1";
const SNAPSHOTS_KEY = "palette-recolor-studio-snapshots-v1";
const EXPORT_VERSION = 1;
const RECOLOR_PREVIEW_DEBOUNCE_MS = 750;

function fileReference(file) {
  if (!file) return null;
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    path: file.path || file.webkitRelativePath || file.name,
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not save image preview."));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function sourceImportLabel(imported, fallbackReference) {
  const dimensions =
    imported?.sourceWidth && imported?.sourceHeight
      ? ` (${imported.sourceWidth}x${imported.sourceHeight})`
      : imported?.meta
        ? ` (${imported.meta})`
        : "";
  const fileSize = imported?.fileSize ?? fallbackReference?.fileSize;
  const size = fileSize ? ` ${formatFileSize(fileSize)}` : "";
  return `${imported?.fileName ?? imported?.name ?? "Source"}${dimensions}${size}`;
}

function dataUrlFileSize(dataUrl) {
  const [, payload = ""] = dataUrl.split(",");
  if (!payload) return 0;
  return Math.floor((payload.length * 3) / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
}

async function dataUrlToFile(dataUrl, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

function loadDataUrlImage(dataUrl, fileName, fileSize = dataUrlFileSize(dataUrl)) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        fileName,
        fileSize,
        width: image.naturalWidth,
        height: image.naturalHeight,
        image,
        url: dataUrl,
        persisted: true,
      });
    image.onerror = () => reject(new Error("Could not restore saved image."));
    image.src = dataUrl;
  });
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (state?.workspaceColors) {
      state.workspaceColors = state.workspaceColors.map((color) => ({
        ...color,
        enabled: color.enabled !== false,
      }));
    }
    if (!state?.swatchViews && state?.swatchView) {
      state.swatchViews = {
        workspace: state.swatchView,
      };
    }
    return state;
  } catch {
    return null;
  }
}

function loadSnapshots() {
  try {
    const snapshots = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) ?? "[]");
    return Array.isArray(snapshots) ? snapshots : [];
  } catch {
    return [];
  }
}

function snapshotHash() {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function friendlyTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return "just now";
  if (elapsed < hour) {
    const count = Math.floor(elapsed / minute);
    return `${count} ${count === 1 ? "minute" : "minutes"} ago`;
  }
  if (elapsed < day) {
    const count = Math.floor(elapsed / hour);
    return `${count} ${count === 1 ? "hour" : "hours"} ago`;
  }
  const count = Math.floor(elapsed / day);
  return `${count} ${count === 1 ? "day" : "days"} ago`;
}

function FloatingBar({ ariaLabel, children, className = "", orientation = "vertical" }) {
  return (
    <div className={`floating-bar ${orientation} ${className}`} aria-label={ariaLabel}>
      {children}
    </div>
  );
}

function TooltipButton({ children, tooltip, ...buttonProps }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button {...buttonProps}>{children}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip-content" sideOffset={6}>
          {tooltip}
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function SettingSelect({ ariaLabel, onValueChange, options, value }) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger className="setting-select-trigger" aria-label={ariaLabel}>
        <Select.Value className="setting-select-value" />
        <Select.Icon asChild>
          <ChevronDown aria-hidden="true" size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="setting-select-content" position="popper" sideOffset={6}>
          <Select.Viewport className="setting-select-viewport">
            {options.map((option) => (
              <Select.Item className="setting-select-item" key={option.value} value={option.value}>
                <Select.ItemText>
                  <span className="setting-select-item-text">{option.label}</span>
                </Select.ItemText>
                <Select.ItemIndicator className="setting-select-indicator">
                  <Check aria-hidden="true" size={13} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function CollapsiblePanel({ actions, children, expanded, onExpandedChange, subtitle, title }) {
  return (
    <section className={`panel collapsible-panel ${expanded ? "" : "collapsed"}`}>
      <div className="panel-title collapsible-title">
        <button
          className="panel-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange?.(!expanded)}
        >
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
        {actions}
      </div>
      {expanded && <div className="collapsible-content">{children}</div>}
    </section>
  );
}

function ResizableToolLayout({ main, sidebar }) {
  return (
    <PanelGroup
      className="tool-grid"
      defaultLayout={{ sidebar: 28, main: 72 }}
      id="palette-recolor-layout"
      orientation="horizontal"
      resizeTargetMinimumSize={{ coarse: 36, fine: 18 }}
    >
      <Panel
        className="tool-grid-pane"
        defaultSize="28%"
        id="sidebar"
        maxSize="640px"
        minSize="320px"
      >
        {sidebar}
      </Panel>
      <PanelResizeHandle className="tool-grid-splitter" id="sidebar-splitter" aria-label="Resize sidebar" />
      <Panel className="tool-grid-pane" defaultSize="72%" id="main" minSize="620px">
        {main}
      </Panel>
    </PanelGroup>
  );
}

function App() {
  const savedState = useMemo(loadSavedState, []);
  const savedSnapshots = useMemo(loadSnapshots, []);
  const [activeSource, setActiveSource] = useState(savedState?.activeSource ?? "palette");
  const [paletteImport, setPaletteImport] = useState(savedState?.paletteImport ?? null);
  const [imageImport, setImageImport] = useState(savedState?.imageImport ?? null);
  const [sourceImageFile, setSourceImageFile] = useState(null);
  const [sourceImagePreview, setSourceImagePreview] = useState(savedState?.sourceImagePreview ?? null);
  const [sourceImageReference, setSourceImageReference] = useState(savedState?.sourceImageReference ?? null);
  const [workspaceColors, setWorkspaceColors] = useState(savedState?.workspaceColors ?? []);
  const [swatchViews, setSwatchViews] = useState(savedState?.swatchViews ?? {});
  const [collapsedPanels, setCollapsedPanels] = useState(savedState?.collapsedPanels ?? {});
  const [targetImage, setTargetImage] = useState(null);
  const [targetImageSnapshot, setTargetImageSnapshot] = useState(savedState?.targetImageSnapshot ?? null);
  const [targetImageReference, setTargetImageReference] = useState(savedState?.targetImageReference ?? null);
  const [extractSettings, setExtractSettings] = useState({
    ...DEFAULT_EXTRACT,
    ...(savedState?.extractSettings ?? {}),
  });
  const [recolorSettings, setRecolorSettings] = useState({
    ...DEFAULT_RECOLOR,
    ...(savedState?.recolorSettings ?? {}),
  });
  const [snapshots, setSnapshots] = useState(savedSnapshots);
  const [isSnapshotMenuOpen, setIsSnapshotMenuOpen] = useState(false);
  const [snapshotToLoad, setSnapshotToLoad] = useState(null);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [targetError, setTargetError] = useState("");
  const [recolorProgress, setRecolorProgress] = useState(0);
  const [isRecoloring, setIsRecoloring] = useState(false);
  const [dragging, setDragging] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const recolorJobIdRef = useRef(0);
  const previewPanRef = useRef(null);
  const previewStackRef = useRef(null);
  const importStateInputRef = useRef(null);
  const targetImageInputRef = useRef(null);
  const snapshotMenuRef = useRef(null);

  const activeImport = activeSource === "palette" ? paletteImport : imageImport;
  const activeWorkspaceColors = useMemo(
    () => workspaceColors.filter((color) => color.enabled !== false),
    [workspaceColors],
  );
  const workspaceColorKeys = useMemo(() => workspaceColors.map((color) => color.hex), [workspaceColors]);
  const activeImportSwatchId = activeImport
    ? `source:${activeImport.type}:${activeImport.fileName ?? activeImport.name}`
    : "source:none";
  const recolorStrength = Number.isFinite(recolorSettings.strength)
    ? recolorSettings.strength
    : DEFAULT_RECOLOR.strength;
  const canRecolor = Boolean(targetImage && activeWorkspaceColors.length);
  const canPanPreview = previewZoom > 1;

  useEffect(() => {
    recolorJobIdRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;

    if (!targetImage || !activeWorkspaceColors.length || !canvasRef.current) {
      setIsRecoloring(false);
      setRecolorProgress(0);
      return undefined;
    }

    setIsRecoloring(false);
    setRecolorProgress(0);

    const jobId = recolorJobIdRef.current;
    const timeoutId = window.setTimeout(() => {
      if (jobId !== recolorJobIdRef.current || !canvasRef.current) return;

      const worker = new Worker(new URL("./recolorWorker.js", import.meta.url), { type: "module" });
      workerRef.current = worker;

      const canvas = canvasRef.current;
      const sourceImageData = drawSourceImageToCanvas(canvas, targetImage, recolorSettings);
      setIsRecoloring(true);
      setRecolorProgress(4);

      worker.onmessage = (event) => {
        const message = event.data;
        if (message.id !== recolorJobIdRef.current) return;

        if (message.type === "progress") {
          setRecolorProgress(message.progress);
        } else if (message.type === "done") {
          canvas.getContext("2d").putImageData(message.imageData, 0, 0);
          setRecolorProgress(100);
          window.setTimeout(() => {
            if (jobId === recolorJobIdRef.current) {
              setIsRecoloring(false);
              setRecolorProgress(0);
            }
          }, 180);
        } else if (message.type === "error") {
          setTargetError(message.message);
          setIsRecoloring(false);
          setRecolorProgress(0);
        }
      };

      worker.postMessage(
        {
          id: jobId,
          imageData: sourceImageData,
          paletteColors: activeWorkspaceColors,
          settings: recolorSettings,
        },
        [sourceImageData.data.buffer],
      );
    }, RECOLOR_PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [targetImage, activeWorkspaceColors, recolorSettings]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    [],
  );

  useEffect(() => {
    if (sourceImageFile) {
      extractSourceImage(sourceImageFile);
      return;
    }
    if (!sourceImagePreview?.url) return;
    dataUrlToFile(sourceImagePreview.url, sourceImagePreview.fileName)
      .then((file) => {
        setSourceImageFile(file);
        return extractSourceImage(file);
      })
      .catch(() => setImageError("Could not restore the source image for re-extraction."));
  }, [extractSettings, sourceImageFile, sourceImagePreview]);

  useEffect(() => {
    if (!targetImageSnapshot || targetImage) return;
    loadDataUrlImage(targetImageSnapshot.url, targetImageSnapshot.fileName, targetImageSnapshot.fileSize)
      .then(setTargetImage)
      .catch(() => setTargetImageSnapshot(null));
  }, [targetImageSnapshot, targetImage]);

  useEffect(() => {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
    } catch {
      // Snapshots are convenience state; keep the in-memory list if storage is full.
    }
  }, [snapshots]);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!snapshotMenuRef.current?.contains(event.target)) {
        setIsSnapshotMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentClick);
    return () => document.removeEventListener("pointerdown", handleDocumentClick);
  }, []);

  useEffect(() => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setIsPreviewPanning(false);
  }, [targetImage?.url]);

  useEffect(() => {
    setPreviewPan((pan) => clampPreviewPan(pan, previewZoom));
  }, [previewZoom, targetImage?.url, activeWorkspaceColors.length]);

  useEffect(() => {
    const state = {
      activeSource,
      paletteImport,
      imageImport,
      sourceImageReference,
      sourceImagePreview,
      workspaceColors,
      swatchViews,
      collapsedPanels,
      targetImageReference,
      targetImageSnapshot,
      extractSettings,
      recolorSettings,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Browser storage can fail for very large images; keep the in-memory session intact.
    }
  }, [
    activeSource,
    paletteImport,
    imageImport,
    sourceImageReference,
    sourceImagePreview,
    workspaceColors,
    swatchViews,
    collapsedPanels,
    targetImageReference,
    targetImageSnapshot,
    extractSettings,
    recolorSettings,
  ]);

  async function importPaletteFile(file) {
    setError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".afpalette")) {
      setError("Drop an .afpalette file exported from Affinity.");
      return;
    }

    try {
      const parsed = parseAFPalette(await file.arrayBuffer());
      setPaletteImport({
        type: "palette",
        name: parsed.name,
        fileName: file.name,
        fileSize: file.size,
        meta: `v${parsed.version}`,
        colors: parsed.colors,
      });
    } catch (parseError) {
      setPaletteImport(null);
      setError(parseError instanceof Error ? parseError.message : "Could not read that palette.");
    }
  }

  async function importImageFile(file) {
    setImageError("");
    if (!file) return;
    if (sourceImagePreview?.url) URL.revokeObjectURL(sourceImagePreview.url);
    const dataUrl = await fileToDataUrl(file);
    setSourceImagePreview({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      path: file.path || file.webkitRelativePath || file.name,
      url: dataUrl,
    });
    setSourceImageReference(fileReference(file));
    setSourceImageFile(file);
  }

  async function extractSourceImage(file) {
    try {
      const extracted = await extractImagePalette(file, extractSettings);
      setImageImport({
        type: "image",
        name: extracted.name,
        fileName: extracted.fileName,
        fileSize: extracted.fileSize,
        sourceWidth: extracted.sourceWidth,
        sourceHeight: extracted.sourceHeight,
        meta: `${extracted.sourceWidth}x${extracted.sourceHeight}`,
        colors: extracted.colors,
      });
    } catch (extractError) {
      setImageImport(null);
      setImageError(extractError instanceof Error ? extractError.message : "Could not extract colors.");
    }
  }

  async function importTargetFile(file) {
    setTargetError("");
    if (!file) return;
    if (targetImage?.url && !targetImage.persisted) URL.revokeObjectURL(targetImage.url);

    try {
      const [loadedImage, dataUrl] = await Promise.all([loadImageFile(file), fileToDataUrl(file)]);
      setTargetImage(loadedImage);
      setTargetImageSnapshot({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        path: file.path || file.webkitRelativePath || file.name,
        url: dataUrl,
      });
      setTargetImageReference(fileReference(file));
      resetPreviewZoom();
    } catch (loadError) {
      setTargetImage(null);
      setTargetImageSnapshot(null);
      setTargetError(loadError instanceof Error ? loadError.message : "Could not load that image.");
    }
  }

  function addColor(color, source) {
    setWorkspaceColors((colors) => {
      if (colors.some((item) => item.hex === color.hex)) return colors;
      return [
        ...colors,
        {
          ...color,
          id: `${color.hex}-${source.type}-${colors.length}`,
          sourceType: source.type,
          sourceName: source.fileName,
          enabled: true,
        },
      ];
    });
  }

  function addAllFromActiveImport() {
    if (!activeImport) return;
    activeImport.colors.forEach((color) => addColor(color, activeImport));
  }

  function removeWorkspaceColor(id) {
    setWorkspaceColors((colors) => colors.filter((color) => color.id !== id));
  }

  function toggleWorkspaceColor(id) {
    setWorkspaceColors((colors) =>
      colors.map((color) =>
        color.id === id
          ? {
              ...color,
              enabled: color.enabled === false,
            }
          : color,
      ),
    );
  }

  function clearWorkspaceColors() {
    setWorkspaceColors([]);
  }

  function clearUnselectedWorkspaceColors() {
    setWorkspaceColors((colors) => colors.filter((color) => color.enabled !== false));
  }

  function togglePanel(panelId) {
    setCollapsedPanels((panels) => ({
      ...panels,
      [panelId]: !panels[panelId],
    }));
  }

  function buildPortableState() {
    return {
      activeSource,
      paletteImport,
      imageImport,
      sourceImageReference:
        sourceImageReference ??
        (sourceImagePreview
          ? {
              fileName: sourceImagePreview.fileName,
              fileSize: sourceImagePreview.fileSize,
              fileType: sourceImagePreview.fileType,
              path: sourceImagePreview.path || sourceImagePreview.fileName,
            }
          : null),
      targetImageReference: targetImageReference
        ? {
            ...targetImageReference,
            width: targetImage?.width ?? targetImageReference.width,
            height: targetImage?.height ?? targetImageReference.height,
          }
        : targetImageSnapshot
          ? {
              fileName: targetImageSnapshot.fileName,
              fileSize: targetImageSnapshot.fileSize,
              fileType: targetImageSnapshot.fileType,
              path: targetImageSnapshot.path || targetImageSnapshot.fileName,
              width: targetImage?.width,
              height: targetImage?.height,
            }
          : null,
      workspaceColors,
      swatchViews,
      collapsedPanels,
      extractSettings,
      recolorSettings,
    };
  }

  function buildSnapshotState() {
    return {
      ...buildPortableState(),
      sourceImagePreview,
      targetImageSnapshot,
    };
  }

  function buildExportPayload(state = buildPortableState()) {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      state,
    };
  }

  function exportState() {
    const exportPayload = buildExportPayload();
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `palette-recolor-studio-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function applyImportedState(importedState) {
    if (!importedState || typeof importedState !== "object") {
      throw new Error("Invalid state file.");
    }

    if (targetImage?.url && !targetImage.persisted) URL.revokeObjectURL(targetImage.url);

    setActiveSource(importedState.activeSource ?? "palette");
    setPaletteImport(importedState.paletteImport ?? null);
    setImageImport(importedState.imageImport ?? null);
    setSourceImageFile(null);
    setSourceImagePreview(importedState.sourceImagePreview ?? null);
    setSourceImageReference(importedState.sourceImageReference ?? null);
    setWorkspaceColors(
      (importedState.workspaceColors ?? []).map((color) => ({
        ...color,
        enabled: color.enabled !== false,
      })),
    );
    setSwatchViews(importedState.swatchViews ?? {});
    setCollapsedPanels(importedState.collapsedPanels ?? {});
    setTargetImage(null);
    setTargetImageSnapshot(importedState.targetImageSnapshot ?? null);
    setTargetImageReference(importedState.targetImageReference ?? null);
    setExtractSettings({
      ...DEFAULT_EXTRACT,
      ...(importedState.extractSettings ?? {}),
    });
    setRecolorSettings({
      ...DEFAULT_RECOLOR,
      ...(importedState.recolorSettings ?? {}),
    });
    resetPreviewZoom();
    setImageError("");
    setTargetError("");
  }

  async function importStateFile(file) {
    setError("");
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      applyImportedState(payload.state ?? payload);
      setIsSnapshotMenuOpen(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import that JSON state file.");
    }
  }

  function saveSnapshot() {
    const id = snapshotHash();
    const createdAt = new Date().toISOString();
    const snapshot = {
      id,
      name: `Snapshot #${id}`,
      createdAt,
      state: buildSnapshotState(),
    };
    setSnapshots((items) => [snapshot, ...items]);
    setIsSnapshotMenuOpen(false);
  }

  function confirmLoadSnapshot() {
    if (!snapshotToLoad) return;
    try {
      applyImportedState(snapshotToLoad.state);
      setSnapshotToLoad(null);
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Could not load that snapshot.");
    }
  }

  function updateExtractSetting(key, value) {
    setExtractSettings((settings) => ({
      ...settings,
      [key]: key === "colorLimit" ? Number(value) : value,
    }));
  }

  function updateRecolorSetting(key, value) {
    setRecolorSettings((settings) => ({
      ...settings,
      [key]: key === "strength" || key === "previewSize" ? Number(value) : value,
    }));
  }

  function getSwatchView(instanceId) {
    return {
      ...DEFAULT_SWATCH_VIEW,
      ...(swatchViews[instanceId] ?? {}),
    };
  }

  function updateSwatchView(instanceId, nextView) {
    setSwatchViews((views) => ({
      ...views,
      [instanceId]: {
        ...DEFAULT_SWATCH_VIEW,
        ...(views[instanceId] ?? {}),
        ...nextView,
      },
    }));
  }

  function clampPreviewPan(pan, zoom = previewZoom) {
    const stack = previewStackRef.current;
    const imageElement = stack?.querySelector(
      activeWorkspaceColors.length ? ".preview-canvas:not(.original-preview)" : ".original-preview",
    );
    if (!stack || !imageElement || zoom <= 1) return { x: 0, y: 0 };

    const viewportWidth = stack.clientWidth;
    const viewportHeight = stack.clientHeight;
    const imageWidth = imageElement.offsetWidth;
    const imageHeight = imageElement.offsetHeight;
    const scaledWidth = imageWidth * zoom;
    const scaledHeight = imageHeight * zoom;
    const imageInsetX = Math.max(0, (viewportWidth - imageWidth) / 2);
    const imageInsetY = Math.max(0, (viewportHeight - imageHeight) / 2);
    const maxX = Math.max(0, imageInsetX + (scaledWidth - viewportWidth) / 2);
    const maxY = Math.max(0, imageInsetY + (scaledHeight - viewportHeight) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, pan.x)),
      y: Math.min(maxY, Math.max(-maxY, pan.y)),
    };
  }

  function updatePreviewZoom(delta) {
    setPreviewZoom((zoom) => {
      const nextZoom = Math.min(6, Math.max(1, Number((zoom + delta).toFixed(2))));
      setPreviewPan((pan) => clampPreviewPan(pan, nextZoom));
      return nextZoom;
    });
  }

  function resetPreviewZoom() {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
    setIsPreviewPanning(false);
  }

  function setPreviewToActualSize() {
    if (!targetImage) return;
    const stack = previewStackRef.current;
    const imageElement = stack?.querySelector(".original-preview");
    if (!imageElement?.offsetWidth || !imageElement?.offsetHeight) return;

    const naturalZoom = Math.max(targetImage.width / imageElement.offsetWidth, targetImage.height / imageElement.offsetHeight);
    const nextZoom = Math.min(6, Math.max(0.1, Number(naturalZoom.toFixed(2))));
    setPreviewZoom(nextZoom);
    setPreviewPan({ x: 0, y: 0 });
    setIsPreviewPanning(false);
  }

  function startPreviewPan(event) {
    if (!canPanPreview) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    previewPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: previewPan.x,
      panY: previewPan.y,
    };
    setIsPreviewPanning(true);
  }

  function movePreviewPan(event) {
    const panStart = previewPanRef.current;
    if (!panStart || panStart.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPreviewPan(
      clampPreviewPan({
        x: panStart.panX + event.clientX - panStart.startX,
        y: panStart.panY + event.clientY - panStart.startY,
      }),
    );
  }

  function stopPreviewPan(event) {
    const panStart = previewPanRef.current;
    if (!panStart || panStart.pointerId !== event.pointerId) return;
    previewPanRef.current = null;
    setPreviewPan((pan) => clampPreviewPan(pan));
    setIsPreviewPanning(false);
  }

  function wheelPreviewPan(event) {
    if (!canPanPreview) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? previewStackRef.current?.clientHeight || 1 : 1;
    const deltaX = event.deltaX * unit;
    const deltaY = event.deltaY * unit;
    if (!deltaX && !deltaY) return;

    event.preventDefault();
    event.stopPropagation();
    setPreviewPan((pan) =>
      clampPreviewPan({
        x: pan.x - deltaX,
        y: pan.y - deltaY,
      }),
    );
  }

  function saveRecoloredImage() {
    const canvas = canvasRef.current;
    if (!canvas || !targetImage || !activeWorkspaceColors.length) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setTargetError("Could not export the recolored image.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const baseName = targetImage.fileName.replace(/\.[^.]+$/, "") || "recolored-image";
      link.href = url;
      link.download = `${baseName}-recolored.png`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function handleDrop(event, type) {
    event.preventDefault();
    setDragging("");
    const file = event.dataTransfer.files[0];
    if (type === "palette") importPaletteFile(file);
    if (type === "image") importImageFile(file);
    if (type === "target") importTargetFile(file);
  }

  function resetTool() {
    if (targetImage?.url && !targetImage.persisted) URL.revokeObjectURL(targetImage.url);
    setPaletteImport(null);
    setImageImport(null);
    setSourceImageFile(null);
    setSourceImagePreview(null);
    setSourceImageReference(null);
    setWorkspaceColors([]);
    setCollapsedPanels({});
    setSnapshots([]);
    setTargetImage(null);
    setTargetImageSnapshot(null);
    setTargetImageReference(null);
    resetPreviewZoom();
    setError("");
    setImageError("");
    setTargetError("");
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SNAPSHOTS_KEY);
  }

  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
      <main>
      <section className="workspace">
        <div className="topbar">
          <div className="brand">
            <SwatchBook aria-hidden="true" size={28} />
            <div>
              <h1>Palette Recolor Studio</h1>
              <p>Build a workspace swatch from files, then recolor an image against it.</p>
            </div>
          </div>
        </div>

        <ResizableToolLayout
          sidebar={(
          <aside className="sidebar">
            <CollapsiblePanel
              title="Import Source Colors"
              subtitle="Choose colors to add into the workspace swatch."
              expanded={!collapsedPanels.source}
              onExpandedChange={(expanded) => setCollapsedPanels((panels) => ({ ...panels, source: !expanded }))}
            >
                  <RadioGroup.Root
                    className="tab-switcher"
                    value={activeSource}
                    onValueChange={setActiveSource}
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
                          setDragging("palette");
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={() => setDragging("")}
                        onDrop={(event) => handleDrop(event, "palette")}
                      >
                        <input
                          type="file"
                          accept=".afpalette"
                          onChange={(event) => importPaletteFile(event.target.files[0])}
                        />
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
                            onChange={(event) => updateExtractSetting("colorLimit", event.target.value)}
                          />
                        </label>
                        <label>
                          Quantizer
                          <SettingSelect
                            ariaLabel="Image source quantizer"
                            value={extractSettings.paletteQuantization}
                            options={PALETTE_QUANTIZER_OPTIONS}
                            onValueChange={(value) => updateExtractSetting("paletteQuantization", value)}
                          />
                        </label>
                        <label>
                          Distance
                          <SettingSelect
                            ariaLabel="Image source color distance"
                            value={extractSettings.colorDistanceFormula}
                            options={DISTANCE_OPTIONS}
                            onValueChange={(value) => updateExtractSetting("colorDistanceFormula", value)}
                          />
                        </label>
                      </div>
                      <label
                        className={`dropzone image-dropzone ${dragging === "image" ? "dragging" : ""}`}
                        onDragEnter={(event) => {
                          event.preventDefault();
                          setDragging("image");
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={() => setDragging("")}
                        onDrop={(event) => handleDrop(event, "image")}
                      >
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          onChange={(event) => importImageFile(event.target.files[0])}
                        />
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
                        view={getSwatchView(activeImportSwatchId)}
                        onViewChange={(nextView) => updateSwatchView(activeImportSwatchId, nextView)}
                        onColorClick={(color) => addColor(color, activeImport)}
                      />
                      <div className="source-result-actions">
                        <button className="ghost-action" type="button" onClick={addAllFromActiveImport}>
                          Add all
                        </button>
                      </div>
                    </div>
                  )}
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Workspace Swatch"
              expanded={!collapsedPanels.workspace}
              onExpandedChange={(expanded) => setCollapsedPanels((panels) => ({ ...panels, workspace: !expanded }))}
              actions={
                workspaceColors.length > 0 && (
                  <button
                    className="icon-button panel-action"
                    type="button"
                    title="Clear workspace swatch"
                    aria-label="Clear workspace swatch"
                    onClick={clearWorkspaceColors}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
              )}
            >
              {workspaceColors.length ? (
                <ColorSwatch
                  colors={workspaceColors}
                  removable
                  selectable
                  view={getSwatchView("workspace")}
                  onViewChange={(nextView) => updateSwatchView("workspace", nextView)}
                  onClearUnselected={clearUnselectedWorkspaceColors}
                  onColorToggle={(color) => toggleWorkspaceColor(color.id)}
                  onColorRemove={(color) => removeWorkspaceColor(color.id)}
                />
              ) : (
                <div className="empty-panel">No workspace colors selected.</div>
              )}
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Snapshots"
              subtitle={`${snapshots.length} saved workspace versions.`}
              expanded={!collapsedPanels.snapshots}
              onExpandedChange={(expanded) => setCollapsedPanels((panels) => ({ ...panels, snapshots: !expanded }))}
              actions={
                <div className="snapshot-menu" ref={snapshotMenuRef}>
                  <button
                    className="icon-button snapshot-menu-button"
                    type="button"
                    title="Snapshot actions"
                    aria-label="Snapshot actions"
                    aria-expanded={isSnapshotMenuOpen}
                    onClick={() => setIsSnapshotMenuOpen((open) => !open)}
                  >
                    <MoreVertical aria-hidden="true" size={16} />
                  </button>
                  {isSnapshotMenuOpen && (
                    <div className="snapshot-menu-popover" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          importStateInputRef.current?.click();
                        }}
                      >
                        <Upload aria-hidden="true" size={14} />
                        Import
                      </button>
                      <button type="button" role="menuitem" onClick={exportState}>
                        <Download aria-hidden="true" size={14} />
                        Export
                      </button>
                      <button type="button" role="menuitem" onClick={saveSnapshot}>
                        <Save aria-hidden="true" size={14} />
                        Save
                      </button>
                    </div>
                  )}
                  <input
                    ref={importStateInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => {
                      importStateFile(event.target.files[0]);
                      event.target.value = "";
                    }}
                  />
                </div>
              }
            >
              <div className="snapshots-list">
                {snapshots.length ? (
                  snapshots.map((snapshot) => (
                    <div
                      className="snapshot-item"
                      key={snapshot.id}
                    >
                      <div className="snapshot-item-text">
                        <strong>{snapshot.name}</strong>
                        <span>- {friendlyTime(snapshot.createdAt)}</span>
                      </div>
                      <button
                        className="snapshot-load-button"
                        type="button"
                        aria-label={`Load ${snapshot.name}`}
                        onClick={() => setSnapshotToLoad(snapshot)}
                      >
                        <FolderOpen aria-hidden="true" size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="snapshots-empty">No snapshots saved.</div>
                )}
              </div>
            </CollapsiblePanel>
          </aside>
          )}
          main={(
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
                      onValueChange={(value) => updateRecolorSetting("imageQuantization", value)}
                    />
                  </label>
                  <label>
                    Distance
                    <SettingSelect
                      ariaLabel="Recolor color distance"
                      value={recolorSettings.colorDistanceFormula}
                      options={DISTANCE_OPTIONS}
                      onValueChange={(value) => updateRecolorSetting("colorDistanceFormula", value)}
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
                      onValueChange={([value]) => updateRecolorSetting("strength", value)}
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
                  <div
                    className={`dropzone target-dropzone preview-dropzone ${
                      dragging === "target" ? "dragging" : ""
                    } ${targetImage ? "has-image" : ""}`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragging("target");
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setDragging("")}
                    onDrop={(event) => handleDrop(event, "target")}
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
                        importTargetFile(event.target.files[0]);
                        event.target.value = "";
                      }}
                    />
                    <FloatingBar
                      ariaLabel="Image actions"
                      className="preview-image-actions"
                      orientation="horizontal"
                    >
                      <TooltipButton
                        type="button"
                        aria-label="Save recolored image"
                        tooltip="Save recolored image"
                        disabled={!targetImage || !activeWorkspaceColors.length}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          saveRecoloredImage();
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
                          {targetImage.fileName} ({targetImage.width}x{targetImage.height} -{" "}
                          {formatFileSize(targetImage.fileSize)})
                        </div>
                        <div
                          ref={previewStackRef}
                          className={`preview-stack ${canPanPreview ? "can-pan" : ""} ${
                            isPreviewPanning ? "is-panning" : ""
                          }`}
                          onPointerDown={startPreviewPan}
                          onPointerMove={movePreviewPan}
                          onPointerUp={stopPreviewPan}
                          onPointerCancel={stopPreviewPan}
                          onWheel={wheelPreviewPan}
                        >
                          <div
                            className="preview-viewport-content"
                            style={{
                              transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                            }}
                          >
                            <canvas
                              ref={canvasRef}
                              className={`preview-canvas ${activeWorkspaceColors.length ? "" : "hidden-canvas"}`}
                            />
                            <img
                              className={`preview-canvas original-preview ${
                                activeWorkspaceColors.length && !showOriginal ? "hidden-original" : ""
                              }`}
                              src={targetImage.url}
                              alt=""
                            />
                            {isRecoloring && (
                              <div
                                className="recolor-progress-overlay"
                                style={{ transform: `scaleX(${recolorProgress / 100})` }}
                              />
                            )}
                          </div>
                        </div>
                        <FloatingBar
                          ariaLabel="Image zoom controls"
                          className="preview-zoom-controls"
                          orientation="vertical"
                        >
                          {activeWorkspaceColors.length > 0 && (
                            <TooltipButton
                              className="hold-original-button"
                              type="button"
                              aria-label="Hold to show original"
                              tooltip="Hold to show original"
                              onClick={(event) => event.preventDefault()}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                setShowOriginal(true);
                              }}
                              onPointerUp={() => setShowOriginal(false)}
                              onPointerCancel={() => setShowOriginal(false)}
                              onPointerLeave={() => setShowOriginal(false)}
                              onKeyDown={(event) => {
                                if (event.key === " " || event.key === "Enter") setShowOriginal(true);
                              }}
                              onKeyUp={() => setShowOriginal(false)}
                            >
                              <Eye aria-hidden="true" size={15} />
                            </TooltipButton>
                          )}
                          <TooltipButton
                            type="button"
                            aria-label="Zoom in"
                            tooltip="Zoom in"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              updatePreviewZoom(0.25);
                            }}
                          >
                            <ZoomIn aria-hidden="true" size={15} />
                          </TooltipButton>
                          <TooltipButton
                            type="button"
                            aria-label="Zoom out"
                            tooltip="Zoom out"
                            disabled={previewZoom === 1}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              updatePreviewZoom(-0.25);
                            }}
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
                              setPreviewToActualSize();
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
                              resetPreviewZoom();
                            }}
                          >
                            <RotateCcw aria-hidden="true" size={14} />
                          </TooltipButton>
                        </FloatingBar>
                        {!activeWorkspaceColors.length && (
                          <div className="preview-hint">Add workspace colors to recolor this image.</div>
                        )}
                      </>
                    ) : (
                      <button className="preview-empty" type="button">
                        <ImagePlus aria-hidden="true" size={30} />
                        <span>Drop the image to recolor</span>
                      </button>
                    )}
                  </div>
                  {targetError && <div className="status error">{targetError}</div>}
                </div>
              </div>
            </section>
          </section>
          )}
        />
      </section>
      <Dialog.Root open={Boolean(snapshotToLoad)} onOpenChange={(open) => !open && setSnapshotToLoad(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title className="dialog-title">Load snapshot?</Dialog.Title>
            <Dialog.Description className="dialog-description">
              Loading {snapshotToLoad?.name} will replace the current workspace, swatches, and settings.
            </Dialog.Description>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button className="ghost-action" type="button">
                  Cancel
                </button>
              </Dialog.Close>
              <button className="dialog-confirm" type="button" onClick={confirmLoadSnapshot}>
                Load
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      </main>
    </Tooltip.Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
