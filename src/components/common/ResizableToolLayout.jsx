import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";

export function ResizableToolLayout({ main, sidebar }) {
  return (
    <PanelGroup
      className="tool-grid"
      defaultLayout={{ sidebar: 28, main: 72 }}
      id="palette-recolor-layout"
      orientation="horizontal"
      resizeTargetMinimumSize={{ coarse: 36, fine: 18 }}
    >
      <Panel className="tool-grid-pane" defaultSize="28%" id="sidebar" maxSize="640px" minSize="320px">
        {sidebar}
      </Panel>
      <PanelResizeHandle className="tool-grid-splitter" id="sidebar-splitter" aria-label="Resize sidebar" />
      <Panel className="tool-grid-pane" defaultSize="72%" id="main" minSize="620px">
        {main}
      </Panel>
    </PanelGroup>
  );
}
