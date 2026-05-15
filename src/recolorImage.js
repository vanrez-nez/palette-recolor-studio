function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Choose an image file to recolor."));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        fileName: file.name,
        fileSize: file.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
        image,
        url,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load that image."));
    };
    image.src = url;
  });
}

function drawSourceImageToCanvas(canvas, source, settings) {
  const maxSide = settings.previewSize;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const scaledWidth = Math.max(1, Math.round(source.width * scale));
  const scaledHeight = Math.max(1, Math.round(source.height * scale));
  const distortsAspectRatio = scaledWidth * source.height !== scaledHeight * source.width;

  canvas.width = distortsAspectRatio ? source.width : scaledWidth;
  canvas.height = distortsAspectRatio ? source.height : scaledHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

export { drawSourceImageToCanvas, loadImageFile };
