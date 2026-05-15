export function fileReference(file) {
  if (!file) return null;
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    path: file.path || file.webkitRelativePath || file.name,
  };
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not save image preview."));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes) {
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

export function dataUrlFileSize(dataUrl) {
  const [, payload = ""] = dataUrl.split(",");
  if (!payload) return 0;
  return Math.floor((payload.length * 3) / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
}

export async function dataUrlToFile(dataUrl, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

export function loadDataUrlImage(dataUrl, fileName, fileSize = dataUrlFileSize(dataUrl)) {
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

export function sourceImportLabel(imported, fallbackReference) {
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
