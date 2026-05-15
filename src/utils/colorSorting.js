import * as iq from "image-q";
import { converter } from "culori";

export const COLOR_SORT_GROUPS = [
  {
    label: "Perceptual",
    options: [
      { value: "oklch-hue", label: "OKLCh hue" },
      { value: "oklab-lightness", label: "OKLab lightness" },
      { value: "lab-lightness", label: "L* lightness" },
      { value: "oklch-chroma", label: "OKLCh chroma" },
    ],
  },
  {
    label: "Luminance",
    options: [
      { value: "rec709-luminance", label: "Rec.709 luminance" },
      { value: "hsv-value", label: "HSV value" },
      { value: "hsv-saturation", label: "HSV saturation" },
    ],
  },
  {
    label: "RGB channel",
    options: [
      { value: "rgb-red", label: "Red" },
      { value: "rgb-green", label: "Green" },
      { value: "rgb-blue", label: "Blue" },
    ],
  },
  {
    label: "Distance",
    options: [
      { value: "euclidean", label: "Euclidean" },
      { value: "euclidean-bt709-noalpha", label: "BT.709" },
      { value: "euclidean-bt709", label: "BT.709 alpha" },
      { value: "manhattan", label: "Manhattan" },
      { value: "manhattan-bt709", label: "Manhattan BT.709" },
      { value: "manhattan-nommyde", label: "Manhattan Nommyde" },
      { value: "ciede2000", label: "CIEDE2000" },
      { value: "cie94-textiles", label: "CIE94 textiles" },
      { value: "cie94-graphic-arts", label: "CIE94 graphic arts" },
      { value: "color-metric", label: "Color metric" },
      { value: "pngquant", label: "PNGQuant" },
    ],
  },
];

export const COLOR_SORT_OPTIONS = COLOR_SORT_GROUPS.flatMap((group) => group.options);

const DISTANCE_CALCULATORS = {
  "cie94-graphic-arts": iq.distance.CIE94GraphicArts,
  "cie94-textiles": iq.distance.CIE94Textiles,
  "ciede2000": iq.distance.CIEDE2000,
  "color-metric": iq.distance.CMetric,
  euclidean: iq.distance.Euclidean,
  "euclidean-bt709": iq.distance.EuclideanBT709,
  "euclidean-bt709-noalpha": iq.distance.EuclideanBT709NoAlpha,
  manhattan: iq.distance.Manhattan,
  "manhattan-bt709": iq.distance.ManhattanBT709,
  "manhattan-nommyde": iq.distance.ManhattanNommyde,
  pngquant: iq.distance.PNGQuant,
};

const toOklch = converter("oklch");
const toOklab = converter("oklab");
const toLab = converter("lab");
const toHsv = converter("hsv");

function colorPoint(color) {
  return iq.utils.Point.createByRGBA(color.r, color.g, color.b, color.a ?? 255);
}

function luminance(color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function colorRgb(color) {
  return {
    mode: "rgb",
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    alpha: (color.a ?? 255) / 255,
  };
}

function stableColorKey(color, index) {
  return `${color.hex ?? ""}:${color.name ?? ""}:${index}`;
}

function compareStartColor(a, b) {
  const lumaDiff = luminance(a.color) - luminance(b.color);
  if (lumaDiff) return lumaDiff;
  return stableColorKey(a.color, a.index).localeCompare(stableColorKey(b.color, b.index));
}

function finiteValue(value, fallback = Number.POSITIVE_INFINITY) {
  return Number.isFinite(value) ? value : fallback;
}

function keyedSort(colors, sortMode) {
  const keyedColors = colors.map((color, index) => {
    const rgb = colorRgb(color);
    const oklch = sortMode.startsWith("oklch") ? toOklch(rgb) : null;
    const hsv = sortMode.startsWith("hsv") ? toHsv(rgb) : null;
    let key = 0;
    let secondaryKey = luminance(color);

    switch (sortMode) {
      case "oklch-hue":
        key = finiteValue(oklch?.h);
        secondaryKey = finiteValue(oklch?.c, 0);
        break;
      case "oklab-lightness":
        key = finiteValue(toOklab(rgb)?.l);
        break;
      case "lab-lightness":
        key = finiteValue(toLab(rgb)?.l);
        break;
      case "rec709-luminance":
        key = luminance(color);
        break;
      case "hsv-value":
        key = finiteValue(hsv?.v);
        break;
      case "hsv-saturation":
        key = finiteValue(hsv?.s);
        secondaryKey = finiteValue(hsv?.v);
        break;
      case "oklch-chroma":
        key = finiteValue(oklch?.c);
        secondaryKey = finiteValue(oklch?.h);
        break;
      case "rgb-red":
        key = color.r;
        break;
      case "rgb-green":
        key = color.g;
        break;
      case "rgb-blue":
        key = color.b;
        break;
      default:
        key = luminance(color);
        break;
    }

    return { color, index, key, secondaryKey };
  });

  return keyedColors
    .sort((a, b) => {
      const keyDiff = a.key - b.key;
      if (keyDiff) return keyDiff;
      const secondaryDiff = a.secondaryKey - b.secondaryKey;
      if (secondaryDiff) return secondaryDiff;
      return stableColorKey(a.color, a.index).localeCompare(stableColorKey(b.color, b.index));
    })
    .map((item) => item.color);
}

function distanceSort(colors, distanceFormula) {
  if (!Array.isArray(colors) || colors.length < 2) return colors ?? [];

  const DistanceCalculator = DISTANCE_CALCULATORS[distanceFormula] ?? DISTANCE_CALCULATORS.euclidean;
  const distance = new DistanceCalculator();
  const unsorted = colors.map((color, index) => ({
    color,
    index,
    point: colorPoint(color),
  }));
  const [first] = [...unsorted].sort(compareStartColor);
  const sorted = [first];
  unsorted.splice(unsorted.indexOf(first), 1);

  while (unsorted.length) {
    const previous = sorted[sorted.length - 1];
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestTieKey = "";

    unsorted.forEach((candidate, index) => {
      const candidateDistance = distance.calculateNormalized(previous.point, candidate.point);
      const tieKey = stableColorKey(candidate.color, candidate.index);
      if (candidateDistance < bestDistance || (candidateDistance === bestDistance && tieKey < bestTieKey)) {
        bestIndex = index;
        bestDistance = candidateDistance;
        bestTieKey = tieKey;
      }
    });

    sorted.push(unsorted.splice(bestIndex, 1)[0]);
  }

  return sorted.map((item) => item.color);
}

export function sortColors(colors, sortMode = "euclidean") {
  if (!Array.isArray(colors) || colors.length < 2) return colors ?? [];
  if (DISTANCE_CALCULATORS[sortMode]) return distanceSort(colors, sortMode);
  return keyedSort(colors, sortMode);
}
