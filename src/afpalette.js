const encoder = new TextEncoder();

class AFPaletteReader {
  constructor(buffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.offset = 0;
  }

  get remaining() {
    return this.bytes.length - this.offset;
  }

  readUint16() {
    this.ensure(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readUint32() {
    this.ensure(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat32() {
    this.ensure(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readAscii(length) {
    this.ensure(length);
    const value = Array.from(this.bytes.slice(this.offset, this.offset + length), (byte) =>
      String.fromCharCode(byte),
    ).join("");
    this.offset += length;
    return value;
  }

  readUtf8(length) {
    this.ensure(length);
    const value = new TextDecoder("utf-8", { fatal: false }).decode(
      this.bytes.slice(this.offset, this.offset + length),
    );
    this.offset += length;
    return value.replace(/\0+$/g, "");
  }

  skip(length) {
    this.ensure(length);
    this.offset += length;
  }

  seek(position) {
    if (position < 0 || position > this.bytes.length) {
      throw new Error("Parser tried to seek outside the file.");
    }
    this.offset = position;
  }

  readThroughAscii(text) {
    const position = this.findAscii(text);
    if (position === -1) {
      throw new Error(`Could not find ${text} marker.`);
    }
    this.offset = position + text.length;
  }

  findAscii(text) {
    const pattern = encoder.encode(text);
    for (let index = this.offset; index <= this.bytes.length - pattern.length; index += 1) {
      let matched = true;
      for (let patternIndex = 0; patternIndex < pattern.length; patternIndex += 1) {
        if (this.bytes[index + patternIndex] !== pattern[patternIndex]) {
          matched = false;
          break;
        }
      }
      if (matched) return index;
    }
    return -1;
  }

  ensure(length) {
    if (this.remaining < length) {
      throw new Error("Unexpected end of file while reading the palette.");
    }
  }
}

function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function toByte(value) {
  return Math.round(clamp01(value) * 255);
}

function rgbToHex({ r, g, b }) {
  return [r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function floatRgb(r, g, b) {
  return { r: toByte(r), g: toByte(g), b: toByte(b) };
}

function cmykToRgb(c, m, y, k) {
  return floatRgb((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
}

function hueToRgb(p, q, t) {
  let localT = t;
  if (localT < 0) localT += 1;
  if (localT > 1) localT -= 1;
  if (localT < 1 / 6) return p + (q - p) * 6 * localT;
  if (localT < 1 / 2) return q;
  if (localT < 2 / 3) return p + (q - p) * (2 / 3 - localT) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) return floatRgb(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return floatRgb(hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3));
}

function labToRgb(l, a, b) {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const delta = 6 / 29;
  const pivot = (value) =>
    value > delta ? value ** 3 : 3 * delta * delta * (value - 4 / 29);

  x = 95.047 * pivot(x);
  y = 100 * pivot(y);
  z = 108.883 * pivot(z);

  x /= 100;
  y /= 100;
  z /= 100;

  const linearR = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const linearG = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const linearB = x * 0.0557 + y * -0.204 + z * 1.057;
  const gamma = (value) =>
    value > 0.0031308 ? 1.055 * value ** (1 / 2.4) - 0.055 : 12.92 * value;

  return floatRgb(gamma(linearR), gamma(linearG), gamma(linearB));
}

export function parseAFPalette(buffer) {
  const reader = new AFPaletteReader(buffer);
  const bom = reader.readUint32();
  if (bom !== 0x414bff00) {
    throw new Error("This does not look like an Affinity .afpalette file.");
  }

  const version = reader.readUint32();
  if (![10, 11, 12].includes(version)) {
    throw new Error(
      `Unsupported .afpalette version ${version}. This importer currently recognizes v10, v11, and v12.`,
    );
  }

  reader.readThroughAscii("NClP");
  const paletteNameLength = reader.readUint32();
  const paletteName = reader.readAscii(paletteNameLength).replace(/\0+$/g, "") || "Untitled palette";

  reader.readThroughAscii("VlaP");
  const declaredColorCount = reader.readUint32();
  const colors = [];

  for (let index = 0; index < declaredColorCount; index += 1) {
    const start = reader.offset;
    try {
      reader.readThroughAscii("rloC");
      reader.skip(6);
      const colorType = reader.readAscii(4);
      let rgb;

      if (colorType === "ABGR") {
        reader.readThroughAscii("Dloc_");
        rgb = floatRgb(reader.readFloat32(), reader.readFloat32(), reader.readFloat32());
      } else if (colorType === "KYMC") {
        reader.readThroughAscii("Hloc_");
        rgb = cmykToRgb(reader.readFloat32(), reader.readFloat32(), reader.readFloat32(), reader.readFloat32());
      } else if (colorType === "ABAL") {
        reader.readThroughAscii("<loc_");
        const l = (reader.readUint16() / 65535) * 100;
        const a = (reader.readUint16() / 65535) * 256 - 128;
        const b = (reader.readUint16() / 65535) * 256 - 128;
        rgb = labToRgb(l, a, b);
      } else if (colorType === "ALSH") {
        reader.readThroughAscii("Dloc_");
        rgb = hslToRgb(reader.readFloat32(), reader.readFloat32(), reader.readFloat32());
      } else if (colorType === "YARG") {
        reader.readThroughAscii("<loc_");
        const gray = reader.readFloat32();
        rgb = floatRgb(gray, gray, gray);
      } else {
        throw new Error(`Unsupported Affinity color type "${colorType}" at swatch ${index + 1}.`);
      }

      colors.push({ name: `Swatch ${index + 1}`, ...rgb, type: colorType });
    } catch (error) {
      if (error.message.startsWith("Unsupported")) throw error;
      reader.seek(start);
      break;
    }
  }

  const nameMarker = reader.findAscii("VNaP");
  if (nameMarker !== -1) {
    reader.seek(nameMarker + 4);
    reader.readUint32();
    const nameCount = reader.readUint32();
    const readableNameCount = Math.min(nameCount, colors.length);
    for (let index = 0; index < readableNameCount; index += 1) {
      const nameLength = reader.readUint32();
      const name = reader.readUtf8(nameLength).trim();
      if (name) colors[index].name = name;
    }
  }

  if (!colors.length) {
    throw new Error("No swatch colors were found in this palette.");
  }

  return {
    name: paletteName,
    version,
    declaredColorCount,
    colors: colors.map((color, index) => {
      const hex = rgbToHex(color);
      return {
        ...color,
        id: `${hex}-${index}`,
        hex: `#${hex}`,
      };
    }),
  };
}
