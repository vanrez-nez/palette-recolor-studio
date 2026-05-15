const PALETTE_SOURCE_FILES = [
  "palette-sources/paletteer-palettes.json",
  "palette-sources/dictionary-of-colour-combinations-palettes.json",
];

function normalizePalette(palette) {
  if (!palette?.name || !Array.isArray(palette.colors) || !palette.colors.length) return null;

  const colors = palette.colors
    .filter((color) => color?.hex)
    .map((color, index) => {
      const rgb = color.rgb ?? [];
      return {
        id: `${palette.id}:color-${index + 1}`,
        name: color.name ?? color.hex,
        hex: color.hex,
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        rgb,
      };
    })
    .filter((color) => /^#[0-9A-F]{6}$/i.test(color.hex) && color.rgb.length === 3);

  if (!colors.length) return null;

  return {
    id: palette.id,
    type: "built-in",
    source: palette.source,
    collection: palette.collection,
    name: palette.name,
    kind: palette.kind ?? null,
    colors,
  };
}

export async function loadBuiltInCatalog() {
  const payloads = await Promise.all(
    PALETTE_SOURCE_FILES.map(async (file) => {
      const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!response.ok) throw new Error(`Could not load ${file}`);
      return response.json();
    }),
  );

  return payloads
    .flat()
    .map(normalizePalette)
    .filter(Boolean)
    .sort((a, b) => `${a.collection ?? ""} ${a.name}`.localeCompare(`${b.collection ?? ""} ${b.name}`));
}
