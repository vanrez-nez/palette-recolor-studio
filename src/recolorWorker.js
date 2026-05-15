import * as iq from "image-q";

function makePalette(colors) {
  const palette = new iq.utils.Palette();
  colors.forEach((color) => {
    palette.add(iq.utils.Point.createByRGBA(color.r, color.g, color.b, 255));
  });
  return palette;
}

function pointContainerToImageData(pointContainer) {
  return new ImageData(
    new Uint8ClampedArray(pointContainer.toUint8Array()),
    pointContainer.getWidth(),
    pointContainer.getHeight(),
  );
}

self.onmessage = (event) => {
  const { id, imageData, paletteColors, settings } = event.data;

  try {
    self.postMessage({ id, type: "progress", progress: 8 });

    const pointContainer = iq.utils.PointContainer.fromImageData(imageData);
    const palette = makePalette(paletteColors);
    self.postMessage({ id, type: "progress", progress: 28 });

    const quantized = iq.applyPaletteSync(pointContainer, palette, {
      colorDistanceFormula: settings.colorDistanceFormula ?? "euclidean-bt709-noalpha",
      imageQuantization: settings.imageQuantization ?? "nearest",
    });
    self.postMessage({ id, type: "progress", progress: 82 });

    const recolored = pointContainerToImageData(quantized);

    if (settings.strength < 100) {
      const output = recolored.data;
      const original = imageData.data;
      const strength = settings.strength / 100;
      for (let index = 0; index < output.length; index += 4) {
        output[index] = original[index] * (1 - strength) + output[index] * strength;
        output[index + 1] = original[index + 1] * (1 - strength) + output[index + 1] * strength;
        output[index + 2] = original[index + 2] * (1 - strength) + output[index + 2] * strength;
        output[index + 3] = original[index + 3];
      }
    }

    self.postMessage({ id, type: "done", imageData: recolored }, [recolored.data.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : "Could not recolor image.",
    });
  }
};
