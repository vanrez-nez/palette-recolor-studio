# Palette Recolor Studio

A Vite + React tool for building a workspace swatch from Affinity palette files or images, then recoloring an uploaded image against the selected workspace colors.

## Features

- Import colors from `.afpalette` files.
- Extract swatches from source images with configurable quantizer, color count, and distance formula.
- Build a mixed workspace swatch from multiple sources.
- Enable, disable, remove, and clear workspace colors.
- Re-sort swatches by perceptual color properties, luminance, RGB channels, or image-q distance.
- Recolor a target image with configurable palette application settings.
- Preview original vs recolored output, zoom, pan, reset zoom, and view at natural image size.
- Save and load local snapshots, including restorable browser image data.
- Export/import portable JSON state with image references instead of embedded image data.

## Development

```sh
npm install
npm run dev
```

The dev server binds to `127.0.0.1`. If port `5173` is occupied, Vite will choose the next available port.

Build for production:

```sh
npm run build
```

Regenerate the public palette-source JSON files:

```sh
npm run extract:palettes
```

Preview the production build:

```sh
npm run preview
```

## Project Structure

```text
src/
  App.jsx
  main.jsx
  styles.css
  components/
    common/
    image-preview/
    image-recolor/
    input-source-color/
    snapshots/
    workspace-swatch/
  utils/
```

- `src/main.jsx`: React bootstrap only.
- `src/App.jsx`: top-level state orchestration and major component composition.
- `src/components/common`: shared UI controls such as swatches, collapsible panels, floating bars, selects, tooltips, and layout.
- `src/components/input-source-color`: source color import UI plus `.afpalette` parsing and image palette extraction.
- `src/components/workspace-swatch`: workspace swatch panel.
- `src/components/snapshots`: snapshot list, actions, and load confirmation dialog.
- `src/components/image-recolor`: recolor settings UI and recolor worker/utilities.
- `src/components/image-preview`: image preview, toolbar, zoom, pan, and original/recolored toggle UI.
- `src/utils`: storage, constants, and file/data URL helpers.
- `public/palette-sources`: normalized palette JSON extracted from public palette collections.
- `scripts/extractPaletteSources.mjs`: source-data extractor for the public palette JSON files.

## Notes

`public/palette-sources/paletteer-palettes.json` contains Paletteer discrete palettes as grouped colors with only `hex` and `rgb` values.

`public/palette-sources/dictionary-of-colour-combinations-palettes.json` contains Sanzo Wada's 348 combinations as grouped palette colors.

Palette extraction and recoloring use `image-q`. Swatch sorting uses `culori` for OKLab, OKLCh, Lab, and HSV color-space conversions, while image-q distance formulas remain available for nearest-neighbor palette ordering.

Strength is applied after palette quantization as a linear blend between the original pixel and the recolored pixel:

- `0%`: original color
- `100%`: full recolored palette result

Alpha is preserved from the original image.
