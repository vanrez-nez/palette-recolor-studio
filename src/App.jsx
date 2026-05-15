import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { DEFAULT_SWATCH_VIEW } from "./components/common/ColorSwatch.jsx";
import { Footer } from "./components/common/Footer.jsx";
import { Header } from "./components/common/Header.jsx";
import { ResizableToolLayout as ResizableToolLayoutComponent } from "./components/common/ResizableToolLayout.jsx";
import { ImageRecolor } from "./components/image-recolor/ImageRecolor.jsx";
import { drawSourceImageToCanvas, loadImageFile } from "./components/image-recolor/recolorImage.js";
import { InputSourceColors } from "./components/input-source-color/InputSourceColors.jsx";
import { parseAFPalette } from "./components/input-source-color/afpalette.js";
import { loadBuiltInCatalog } from "./components/input-source-color/builtInPalettes.js";
import { extractImagePalette } from "./components/input-source-color/imagePalette.js";
import { SnapshotLoadDialog, SnapshotsPanel } from "./components/snapshots/SnapshotsPanel.jsx";
import { WorkspaceSwatch } from "./components/workspace-swatch/WorkspaceSwatch.jsx";
import { DEFAULT_EXTRACT, DEFAULT_RECOLOR, EXPORT_VERSION, RECOLOR_PREVIEW_DEBOUNCE_MS, SNAPSHOTS_KEY, STORAGE_KEY } from "./utils/constants.js";
import { sortColors } from "./utils/colorSorting.js";
import { dataUrlToFile, fileReference, fileToDataUrl, loadDataUrlImage } from "./utils/files.js";
import { loadSavedState, loadSnapshots, snapshotHash } from "./utils/storage.js";

const DEFAULTS_PATH = "palette-sources/defaults.json";

export default function App() {
  const savedState = useMemo(loadSavedState, []);
  const savedSnapshots = useMemo(loadSnapshots, []);
  const [activeSource, setActiveSource] = useState(savedState?.activeSource ?? "image");
  const [paletteImport, setPaletteImport] = useState(savedState?.paletteImport ?? null);
  const [imageImport, setImageImport] = useState(savedState?.imageImport ?? null);
  const [builtInPalettes, setBuiltInPalettes] = useState(savedState?.builtInPalettes ?? []);
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
  const defaultsLoadedRef = useRef(false);
  const recolorJobIdRef = useRef(0);
  const previewPanRef = useRef(null);
  const previewStackRef = useRef(null);
  const importStateInputRef = useRef(null);
  const targetImageInputRef = useRef(null);
  const snapshotMenuRef = useRef(null);

  const activeImport = activeSource === "palette" ? paletteImport : activeSource === "image" ? imageImport : null;
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

      const worker = new Worker(new URL("./components/image-recolor/recolorWorker.js", import.meta.url), { type: "module" });
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
    if (savedState || defaultsLoadedRef.current) return;
    defaultsLoadedRef.current = true;
    let cancelled = false;

    loadAppDefaults()
      .then(async (defaults) => {
        if (cancelled) return;

        if (defaults.activeSource) {
          setActiveSource(defaults.activeSource);
        }

        if (defaults.sourceImagePath && !sourceImagePreview && !sourceImageFile) {
          loadPublicImageFile(defaults.sourceImagePath)
            .then((file) => {
              if (!cancelled) importImageFile(file, defaults.sourceImagePath);
            })
            .catch(() => setImageError("Could not load the default source image."));
        }

        if (defaults.targetImagePath && !targetImageSnapshot && !targetImage) {
          loadPublicImageFile(defaults.targetImagePath)
            .then((file) => {
              if (!cancelled) importTargetFile(file, defaults.targetImagePath);
            })
            .catch(() => setTargetError("Could not load the default target image."));
        }

        if (Array.isArray(defaults.builtInPaletteIds) && defaults.builtInPaletteIds.length && !builtInPalettes.length) {
          const catalog = await loadBuiltInCatalog();
          const catalogById = new Map(catalog.map((palette) => [palette.id, palette]));
          if (!cancelled) {
            setBuiltInPalettes(defaults.builtInPaletteIds.map((id) => catalogById.get(id)).filter(Boolean));
          }
        }
      })
      .catch(() => {
        setImageError("Could not load the default workspace.");
      });

    return () => {
      cancelled = true;
    };
  }, [savedState]);

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
      builtInPalettes,
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
    builtInPalettes,
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
        colors: sortColors(parsed.colors),
      });
    } catch (parseError) {
      setPaletteImport(null);
      setError(parseError instanceof Error ? parseError.message : "Could not read that palette.");
    }
  }

  async function loadAppDefaults() {
    const response = await fetch(`${import.meta.env.BASE_URL}${DEFAULTS_PATH}`);
    if (!response.ok) throw new Error("Could not load defaults.");
    return response.json();
  }

  async function loadPublicImageFile(path) {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
    if (!response.ok) throw new Error(`Could not load ${path}.`);
    const blob = await response.blob();
    const fileName = path.split("/").pop() || "sample.png";
    return new File([blob], fileName, { type: blob.type || "image/png" });
  }

  function imageReferenceFromFile(file, path) {
    return {
      ...fileReference(file),
      path,
    };
  }

  async function importImageFile(file, referencePath = file?.path || file?.webkitRelativePath || file?.name) {
    setImageError("");
    if (!file) return;
    if (sourceImagePreview?.url) URL.revokeObjectURL(sourceImagePreview.url);
    const dataUrl = await fileToDataUrl(file);
    setSourceImagePreview({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      path: referencePath,
      url: dataUrl,
    });
    setSourceImageReference(imageReferenceFromFile(file, referencePath));
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
        colors: sortColors(extracted.colors),
      });
    } catch (extractError) {
      setImageImport(null);
      setImageError(extractError instanceof Error ? extractError.message : "Could not extract colors.");
    }
  }

  async function importTargetFile(file, referencePath = file?.path || file?.webkitRelativePath || file?.name) {
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
        path: referencePath,
        url: dataUrl,
      });
      setTargetImageReference(imageReferenceFromFile(file, referencePath));
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
          sourceName: source.fileName ?? source.name,
          enabled: true,
        },
      ];
    });
  }

  function addLoadedBuiltInPalette(palette) {
    setBuiltInPalettes((palettes) => {
      if (palettes.some((item) => item.id === palette.id)) return palettes;
      return [...palettes, palette];
    });
    setActiveSource("built-in");
  }

  function removeLoadedBuiltInPalettes(paletteIds) {
    const paletteIdSet = new Set(paletteIds);
    setBuiltInPalettes((palettes) => palettes.filter((palette) => !paletteIdSet.has(palette.id)));
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

  function sortActiveImportColors(distanceFormula) {
    if (!activeImport) return;
    const sortImport = (currentImport) =>
      currentImport
        ? {
            ...currentImport,
            colors: sortColors(currentImport.colors, distanceFormula),
          }
        : null;

    if (activeImport.type === "palette") {
      setPaletteImport(sortImport);
    } else if (activeImport.type === "image") {
      setImageImport(sortImport);
    }
  }

  function sortWorkspaceColors(distanceFormula) {
    setWorkspaceColors((colors) => sortColors(colors, distanceFormula));
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
      builtInPalettes,
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
    setBuiltInPalettes(importedState.builtInPalettes ?? []);
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
    setBuiltInPalettes([]);
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
        <Header />
        <ResizableToolLayoutComponent
          sidebar={(
            <aside className="sidebar">
              <InputSourceColors
                activeImport={activeImport}
                activeImportSwatchId={activeImportSwatchId}
                activeSource={activeSource}
                builtInPalettes={builtInPalettes}
                dragging={dragging}
                error={error}
                extractSettings={extractSettings}
                getSwatchView={getSwatchView}
                imageError={imageError}
                isExpanded={!collapsedPanels.source}
                onAddAll={addAllFromActiveImport}
                onAddColor={addColor}
                onAddLoadedPalette={addLoadedBuiltInPalette}
                onDrop={{ handle: handleDrop, setDragging }}
                onExpandedChange={(expanded) => setCollapsedPanels((panels) => ({ ...panels, source: !expanded }))}
                onImageFile={importImageFile}
                onPaletteFile={importPaletteFile}
                onRemoveLoadedPalettes={removeLoadedBuiltInPalettes}
                onSortColors={sortActiveImportColors}
                onSourceChange={setActiveSource}
                onUpdateExtractSetting={updateExtractSetting}
                onUpdateSwatchView={(idOrView, nextView) => {
                  if (typeof idOrView === "string") {
                    updateSwatchView(idOrView, nextView);
                  } else {
                    updateSwatchView(activeImportSwatchId, idOrView);
                  }
                }}
                sourceImagePreview={sourceImagePreview}
                sourceImageReference={sourceImageReference}
                swatchView={getSwatchView(activeImportSwatchId)}
                workspaceColorKeys={workspaceColorKeys}
              />
              <WorkspaceSwatch
                colors={workspaceColors}
                isExpanded={!collapsedPanels.workspace}
                onClear={clearWorkspaceColors}
                onClearUnselected={clearUnselectedWorkspaceColors}
                onColorRemove={(color) => removeWorkspaceColor(color.id)}
                onColorToggle={(color) => toggleWorkspaceColor(color.id)}
                onExpandedChange={(expanded) => setCollapsedPanels((panels) => ({ ...panels, workspace: !expanded }))}
                onSortColors={sortWorkspaceColors}
                onUpdateSwatchView={(nextView) => updateSwatchView("workspace", nextView)}
                swatchView={getSwatchView("workspace")}
              />
              <SnapshotsPanel
                importInputRef={importStateInputRef}
                isExpanded={!collapsedPanels.snapshots}
                isMenuOpen={isSnapshotMenuOpen}
                menuRef={snapshotMenuRef}
                onExpandedChange={(expanded) => setCollapsedPanels((panels) => ({ ...panels, snapshots: !expanded }))}
                onExport={exportState}
                onImportFile={importStateFile}
                onLoadRequest={setSnapshotToLoad}
                onMenuToggle={() => setIsSnapshotMenuOpen((open) => !open)}
                onSave={saveSnapshot}
                snapshots={snapshots}
              />
            </aside>
          )}
          main={(
            <ImageRecolor
              activeWorkspaceColors={activeWorkspaceColors}
              canvasRef={canvasRef}
              canPanPreview={canPanPreview}
              dragging={dragging}
              isPreviewPanning={isPreviewPanning}
              isRecoloring={isRecoloring}
              onDrop={{ handle: handleDrop, setDragging }}
              onImportTargetFile={importTargetFile}
              onPreviewPanMove={movePreviewPan}
              onPreviewPanStart={startPreviewPan}
              onPreviewPanStop={stopPreviewPan}
              onPreviewWheel={wheelPreviewPan}
              onResetZoom={resetPreviewZoom}
              onSaveRecoloredImage={saveRecoloredImage}
              onSetActualSize={setPreviewToActualSize}
              onShowOriginalChange={setShowOriginal}
              onUpdateRecolorSetting={updateRecolorSetting}
              onZoom={(event, delta) => {
                event.preventDefault();
                event.stopPropagation();
                updatePreviewZoom(delta);
              }}
              previewPan={previewPan}
              previewStackRef={previewStackRef}
              previewZoom={previewZoom}
              recolorProgress={recolorProgress}
              recolorSettings={recolorSettings}
              recolorStrength={recolorStrength}
              showOriginal={showOriginal}
              targetError={targetError}
              targetImage={targetImage}
              targetImageInputRef={targetImageInputRef}
            />
          )}
        />
        <Footer />
      </section>
      <SnapshotLoadDialog
        snapshot={snapshotToLoad}
        onConfirm={confirmLoadSnapshot}
        onOpenChange={(open) => !open && setSnapshotToLoad(null)}
      />
      </main>
    </Tooltip.Provider>
  );
}
