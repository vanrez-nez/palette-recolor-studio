import * as Dialog from "@radix-ui/react-dialog";
import Fuse from "fuse.js";
import { Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SettingSelect } from "../common/SettingSelect.jsx";

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "size", label: "Palette size" },
  { value: "source", label: "Source" },
  { value: "collection", label: "Collection" },
];
const SORT_DIRECTION_OPTIONS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];
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

async function loadBuiltInCatalog() {
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

function PalettePreview({ colors }) {
  return (
    <div className="built-in-palette-preview" aria-hidden="true">
      {colors.slice(0, 24).map((color) => (
        <span key={color.id} style={{ backgroundColor: color.hex }} />
      ))}
    </div>
  );
}

function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

function sortPalettes(palettes, sortBy, sortDirection) {
  const direction = sortDirection === "desc" ? -1 : 1;
  return [...palettes].sort((a, b) => {
    let result = 0;

    if (sortBy === "size") {
      result = a.colors.length - b.colors.length;
    } else if (sortBy === "source") {
      result = compareText(a.source, b.source);
    } else if (sortBy === "collection") {
      result = compareText(a.collection ?? a.source, b.collection ?? b.source);
    } else {
      result = compareText(a.name, b.name);
    }

    if (result) return result * direction;
    const nameDiff = compareText(a.name, b.name);
    if (nameDiff) return nameDiff;
    return compareText(a.id, b.id);
  });
}

export function BuiltInPaletteExplorer({ loadedPaletteIds, onLoadPalette }) {
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    loadBuiltInCatalog()
      .then(setCatalog)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load built-in palettes."));
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(catalog, {
        includeScore: true,
        keys: ["name", "collection", "source", "kind"],
        threshold: 0.32,
      }),
    [catalog],
  );

  const results = useMemo(() => {
    const trimmedQuery = query.trim();
    const filtered = trimmedQuery ? fuse.search(trimmedQuery).map((result) => result.item) : catalog;
    return sortPalettes(filtered, sortBy, sortDirection);
  }, [catalog, fuse, query, sortBy, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageResults = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updateQuery(nextQuery) {
    setQuery(nextQuery);
    setPage(1);
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button className="icon-button built-in-explorer-trigger" type="button" title="Explore palettes" aria-label="Explore palettes">
          <Search aria-hidden="true" size={14} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content palette-explorer-dialog">
          <div className="palette-explorer-title-row">
            <div>
              <Dialog.Title className="dialog-title">Built-in Palettes</Dialog.Title>
              <Dialog.Description className="dialog-description">
                Search public palette collections and load reusable swatches.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button palette-explorer-close" type="button" aria-label="Close palette explorer">
                <X aria-hidden="true" size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="palette-explorer-controls">
            <label className="palette-explorer-search">
              <span>Search</span>
              <input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Palette, source, collection..." />
            </label>
            <label>
              Sort by
              <SettingSelect
                ariaLabel="Sort built-in palettes"
                value={sortBy}
                options={SORT_OPTIONS}
                onValueChange={(value) => {
                  setSortBy(value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Direction
              <SettingSelect
                ariaLabel="Built-in palette sort direction"
                value={sortDirection}
                options={SORT_DIRECTION_OPTIONS}
                onValueChange={(value) => {
                  setSortDirection(value);
                  setPage(1);
                }}
              />
            </label>
          </div>

          {error ? (
            <div className="status error">{error}</div>
          ) : (
            <>
              <div className="palette-explorer-meta">
                {results.length} {results.length === 1 ? "palette" : "palettes"}
              </div>
              <div className="palette-explorer-results">
                {pageResults.map((palette) => {
                  const isLoaded = loadedPaletteIds.has(palette.id);
                  return (
                    <article className="palette-result" key={palette.id}>
                      <div className="palette-result-header">
                        <div>
                          <strong>{palette.name}</strong>
                          <span>{palette.collection ?? palette.source}</span>
                        </div>
                        <button
                          className="icon-button palette-result-add"
                          type="button"
                          disabled={isLoaded}
                          title={isLoaded ? "Palette already loaded" : "Load palette"}
                          aria-label={isLoaded ? `${palette.name} already loaded` : `Load ${palette.name}`}
                          onClick={() => onLoadPalette(palette)}
                        >
                          <Plus aria-hidden="true" size={14} />
                        </button>
                      </div>
                      <PalettePreview colors={palette.colors} />
                    </article>
                  );
                })}
              </div>
              <div className="palette-explorer-pagination">
                <button className="ghost-action" type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Previous
                </button>
                <span>
                  {safePage} / {pageCount}
                </span>
                <button
                  className="ghost-action"
                  type="button"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
