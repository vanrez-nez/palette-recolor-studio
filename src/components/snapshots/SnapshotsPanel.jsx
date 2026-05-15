import * as Dialog from "@radix-ui/react-dialog";
import { Download, FolderOpen, MoreVertical, Save, Upload } from "lucide-react";
import { CollapsiblePanel } from "../common/CollapsiblePanel.jsx";
import { friendlyTime } from "../../utils/storage.js";

export function SnapshotsPanel({
  importInputRef,
  isExpanded,
  isMenuOpen,
  menuRef,
  onExpandedChange,
  onExport,
  onImportFile,
  onLoadRequest,
  onMenuToggle,
  onSave,
  snapshots,
}) {
  return (
    <CollapsiblePanel
      title="Snapshots"
      subtitle={`${snapshots.length} saved workspace versions.`}
      expanded={isExpanded}
      onExpandedChange={onExpandedChange}
      actions={
        <div className="snapshot-menu" ref={menuRef}>
          <button
            className="icon-button snapshot-menu-button"
            type="button"
            title="Snapshot actions"
            aria-label="Snapshot actions"
            aria-expanded={isMenuOpen}
            onClick={onMenuToggle}
          >
            <MoreVertical aria-hidden="true" size={16} />
          </button>
          {isMenuOpen && (
            <div className="snapshot-menu-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => importInputRef.current?.click()}>
                <Upload aria-hidden="true" size={14} />
                Import
              </button>
              <button type="button" role="menuitem" onClick={onExport}>
                <Download aria-hidden="true" size={14} />
                Export
              </button>
              <button type="button" role="menuitem" onClick={onSave}>
                <Save aria-hidden="true" size={14} />
                Save
              </button>
            </div>
          )}
          <input
            ref={importInputRef}
            className="hidden-file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              onImportFile(event.target.files[0]);
              event.target.value = "";
            }}
          />
        </div>
      }
    >
      <div className="snapshots-list">
        {snapshots.length ? (
          snapshots.map((snapshot) => (
            <div className="snapshot-item" key={snapshot.id}>
              <div className="snapshot-item-text">
                <strong>{snapshot.name}</strong>
                <span>- {friendlyTime(snapshot.createdAt)}</span>
              </div>
              <button
                className="snapshot-load-button"
                type="button"
                aria-label={`Load ${snapshot.name}`}
                onClick={() => onLoadRequest(snapshot)}
              >
                <FolderOpen aria-hidden="true" size={14} />
              </button>
            </div>
          ))
        ) : (
          <div className="snapshots-empty">No snapshots saved.</div>
        )}
      </div>
    </CollapsiblePanel>
  );
}

export function SnapshotLoadDialog({ onConfirm, onOpenChange, snapshot }) {
  return (
    <Dialog.Root open={Boolean(snapshot)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title">Load snapshot?</Dialog.Title>
          <Dialog.Description className="dialog-description">
            Loading {snapshot?.name} will replace the current workspace, swatches, and settings.
          </Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="ghost-action" type="button">
                Cancel
              </button>
            </Dialog.Close>
            <button className="dialog-confirm" type="button" onClick={onConfirm}>
              Load
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
