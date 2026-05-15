import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_DIR = "tmp/palette-sources";
const OUTPUT_DIR = "public/palette-sources";
const SOURCES = {
  dictionaryColors: {
    cache: "dictionary-colour-combinations-colors.json",
    url: "https://raw.githubusercontent.com/mattdesl/dictionary-of-colour-combinations/master/colors.json",
  },
  paletteerNames: {
    cache: "paletteer-palettes-d-names.csv",
    url: "https://raw.githubusercontent.com/EmilHvitfeldt/paletteer/main/data-raw/palettes_d_names.csv",
  },
  paletteerPalettes: {
    cache: "paletteer-palettes-d.json",
    url: "https://raw.githubusercontent.com/EmilHvitfeldt/paletteer/main/data-raw/palettes_d.json",
  },
};

function hexToRgb(hex) {
  const normalized = hex.replace("#", "").slice(0, 6);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function normalizeHex(hex) {
  return `#${hex.replace("#", "").slice(0, 6).toUpperCase()}`;
}

function colorFromHex(hex) {
  const normalized = normalizeHex(hex);
  return {
    hex: normalized,
    rgb: hexToRgb(normalized),
  };
}

function sanitizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted && char === "\"" && next === "\"") {
      value += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(value);
      value = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
  );
}

function buildPaletteerPalettes(paletteMap, metadataRows) {
  const metadata = new Map(metadataRows.map((row) => [`${row.package}/${row.palette}`, row]));
  const palettes = [];

  Object.entries(paletteMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([collection, collectionPalettes]) => {
      Object.entries(collectionPalettes)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([name, colors]) => {
          const paletteColors = colors.filter((color) => typeof color === "string" && /^#?[0-9a-f]{6}/i.test(color));
          if (!paletteColors.length) return;

          const row = metadata.get(`${collection}/${name}`);
          palettes.push({
            id: `paletteer:${sanitizeId(collection)}:${sanitizeId(name)}`,
            source: "paletteer",
            collection,
            name,
            kind: row?.type || null,
            colors: paletteColors.map(colorFromHex),
          });
        });
    });

  return palettes;
}

function buildDictionaryPalettes(colors) {
  const combinations = new Map();

  colors.forEach((color, colorIndex) => {
    color.combinations.forEach((combinationId) => {
      if (!combinations.has(combinationId)) combinations.set(combinationId, []);
      combinations.get(combinationId).push({
        name: color.name,
        hex: normalizeHex(color.hex),
        rgb: color.rgb,
        colorId: `dictionary-of-colour-combinations:color-${colorIndex + 1}`,
      });
    });
  });

  return [...combinations.entries()]
    .sort(([a], [b]) => a - b)
    .map(([combinationId, paletteColors]) => ({
      id: `dictionary-of-colour-combinations:combination-${combinationId}`,
      source: "dictionary-of-colour-combinations",
      collection: "A Dictionary of Colour Combinations",
      name: `Combination ${combinationId}`,
      colors: paletteColors,
    }));
}

async function writeJson(fileName, data) {
  await writeFile(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`);
}

async function readSource(source) {
  const cachedPath = path.join(SOURCE_DIR, source.cache);

  try {
    return await readFile(cachedPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${source.url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  await mkdir(SOURCE_DIR, { recursive: true });
  await writeFile(cachedPath, text);
  return text;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const [paletteerRaw, paletteerNamesRaw, dictionaryRaw] = await Promise.all([
    readSource(SOURCES.paletteerPalettes),
    readSource(SOURCES.paletteerNames),
    readSource(SOURCES.dictionaryColors),
  ]);

  const paletteerPalettes = buildPaletteerPalettes(JSON.parse(paletteerRaw), parseCsv(paletteerNamesRaw));
  const dictionaryColors = JSON.parse(dictionaryRaw);
  const dictionaryPalettes = buildDictionaryPalettes(dictionaryColors);

  await Promise.all([
    writeJson("paletteer-palettes.json", paletteerPalettes),
    writeJson("dictionary-of-colour-combinations-palettes.json", dictionaryPalettes),
  ]);

  console.log(
    JSON.stringify(
      {
        paletteerPalettes: paletteerPalettes.length,
        dictionaryPalettes: dictionaryPalettes.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
