import * as iq from "image-q";

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex({ r, g, b }) {
  return [r, g, b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load that image."));
    };
    image.src = url;
  });
}

function getCanvasImageData(image) {
  const canvas = document.createElement("canvas");
  const maxSide = 360;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    width: canvas.width,
    height: canvas.height,
    imageData: context.getImageData(0, 0, canvas.width, canvas.height),
  };
}

export async function extractImagePalette(file, options = {}) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Drop a PNG, JPEG, GIF, or WebP image.");
  }

  const colorLimit = options.colorLimit ?? 12;
  const image = await loadImage(file);
  const { width, height, imageData } = getCanvasImageData(image);
  const pointContainer = iq.utils.PointContainer.fromImageData(imageData);
  const palette = iq.buildPaletteSync([pointContainer], {
    colors: colorLimit,
    paletteQuantization: options.paletteQuantization ?? "wuquant",
    colorDistanceFormula: options.colorDistanceFormula ?? "euclidean-bt709-noalpha",
  });

  const colors = palette
    .getPointContainer()
    .getPointArray()
    .slice(0, colorLimit)
    .map((point, index) => {
      const swatch = {
        name: `Color ${index + 1}`,
        r: clampByte(point.r),
        g: clampByte(point.g),
        b: clampByte(point.b),
        count: 1,
      };
      const hex = rgbToHex(swatch);
      return {
        ...swatch,
        id: `${hex}-${index}`,
        hex: `#${hex}`,
      };
    });

  if (!colors.length) {
    throw new Error("No visible image colors were found.");
  }

  return {
    name: file.name.replace(/\.[^.]+$/, "") || "Image palette",
    fileName: file.name,
    fileSize: file.size,
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
    sampledWidth: width,
    sampledHeight: height,
    colors,
  };
}
