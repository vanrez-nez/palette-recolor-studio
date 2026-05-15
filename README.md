# Palette Recolor Studio

Palette Recolor Studio is a local browser tool for building color swatches and using them to recolor images.

You can collect colors from Affinity palette files, images, and built-in palette collections, then mix those colors into a workspace swatch. Once the workspace swatch is ready, upload a target image and preview how it looks when recolored with those colors.

## Start The Tool

Install the app once:

```sh
npm install
```

Start it:

```sh
npm run dev
```

Open the local address shown in the terminal. It is usually:

```text
http://127.0.0.1:5173/
```

If that port is already busy, Vite will choose the next available one, such as `http://127.0.0.1:5174/`.

## Basic Flow

1. Open **Import Source Colors**.
2. Choose a source:
   - **AFPalette**: drop or choose an `.afpalette` file.
   - **Image**: drop or choose an image and extract colors from it.
   - **Built-in Palettes**: search built-in palette collections and load palettes into the source list.
3. Add individual colors or use the add-all action to move source colors into **Workspace Swatch**.
4. In **Workspace Swatch**, click colors to enable or disable them without removing them.
5. Open **Recolor Image** and load the image you want to recolor.
6. Adjust the recolor settings and preview the result.
7. Save the recolored image from the image toolbar.

## Working With Swatches

The workspace swatch is the active palette used for recoloring.

- Click a workspace color to toggle it on or off.
- Disabled colors stay in the swatch but are ignored by recoloring.
- Use the swatch menu to change display mode, color label format, or re-sort colors.
- Use **Clear Unselected** to remove disabled colors from the swatch.
- Use the trash button in the Workspace Swatch panel to clear all workspace colors.

## Built-in Palettes

The built-in palette explorer lets you search public palette collections and load palettes into the source list.

- Use search to find palettes by name, source, or collection.
- Sort results by name, palette size, source, or collection.
- Load a palette from the explorer, then add colors from it into the workspace swatch.
- In the loaded palette list, hover a row to reveal the add-all button.
- Use the settings button to select and remove loaded built-in palettes.

## Recoloring Images

The target image preview supports:

- Recolored/original comparison by holding the eye button.
- Zoom in, zoom out, reset zoom, and actual-size view.
- Mouse panning when zoomed in.
- Saving the recolored image.
- Loading a different target image from the preview toolbar.

Recolor settings let you control how strongly the workspace swatch is applied and how much original lightness is preserved.

## Snapshots

Snapshots save the current workspace in your browser.

Use them when you want to try different palette or recolor settings without losing a previous setup.

Snapshots include:

- Workspace colors and enabled/disabled state.
- Loaded built-in palettes.
- Current tool settings.
- Image references and browser-restorable image data when available.

You can also import and export the workspace state as JSON from the Snapshots panel.

## Notes

- This is a local tool. Your files are processed in the browser.
- Browser storage is used for saved state and snapshots.
- If you clear browser storage, saved snapshots may be removed.
- Exported JSON stores image references instead of embedding full image files.

## For Maintainers

Useful commands:

```sh
npm run build
npm run preview
npm run extract:palettes
```

`npm run extract:palettes` regenerates the built-in palette JSON files from the source data used by the project.
