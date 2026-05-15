export const DEFAULT_EXTRACT = {
  colorLimit: 12,
  paletteQuantization: "wuquant",
  colorDistanceFormula: "euclidean-bt709-noalpha",
};

export const DEFAULT_RECOLOR = {
  imageQuantization: "nearest",
  colorDistanceFormula: "euclidean-bt709-noalpha",
  strength: 50,
  previewSize: 900,
};

export const PALETTE_QUANTIZER_OPTIONS = [
  { value: "wuquant", label: "WuQuant" },
  { value: "rgbquant", label: "RGBQuant" },
  { value: "neuquant", label: "NeuQuant" },
  { value: "neuquant-float", label: "NeuQuant Float" },
];

export const DISTANCE_OPTIONS = [
  { value: "euclidean-bt709-noalpha", label: "BT.709" },
  { value: "euclidean", label: "Euclidean" },
  { value: "manhattan-bt709", label: "Manhattan" },
  { value: "ciede2000", label: "CIEDE2000" },
  { value: "pngquant", label: "PNGQuant" },
];

export const IMAGE_QUANTIZER_OPTIONS = [
  { value: "nearest", label: "Nearest color" },
  { value: "floyd-steinberg", label: "Floyd-Steinberg" },
  { value: "atkinson", label: "Atkinson" },
  { value: "sierra-lite", label: "Sierra Lite" },
  { value: "riemersma", label: "Riemersma" },
];

export const STORAGE_KEY = "palette-recolor-studio-state-v1";
export const SNAPSHOTS_KEY = "palette-recolor-studio-snapshots-v1";
export const EXPORT_VERSION = 1;
export const RECOLOR_PREVIEW_DEBOUNCE_MS = 750;
