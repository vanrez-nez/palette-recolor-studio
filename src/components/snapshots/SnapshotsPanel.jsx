import * as Dialog from "@radix-ui/react-dialog";
import { Download, FolderOpen, MoreVertical, Save, Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CollapsiblePanel } from "../common/CollapsiblePanel.jsx";
import { friendlyTime } from "../../utils/storage.js";

const SNAPSHOT_MENU_WIDTH = 156;
const VIEWPORT_PADDING = 8;

function getMenuPosition(trigger) {
  const rect = trigger.getBoundingClientRect();
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - SNAPSHOT_MENU_WIDTH - VIEWPORT_PADDING);
  const left = Math.min(Math.max(VIEWPORT_PADDING, rect.right - SNAPSHOT_MENU_WIDTH), maxLeft);

  return {
    left,
    top: rect.bottom + 6,
  };
}

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
  const menuButtonRef = useRef(null);
  const popoverRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function updatePosition() {
      if (menuButtonRef.current) {
        setMenuPosition(getMenuPosition(menuButtonRef.current));
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isMenuOpen]);

  useLayoutEffect(() => {
    if (!isMenuOpen || !popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - rect.height - VIEWPORT_PADDING);
    const nextTop = Math.min(Math.max(VIEWPORT_PADDING, rect.top), maxTop);
    if (Math.abs(nextTop - rect.top) > 0.5) {
      setMenuPosition((position) => (position ? { ...position, top: nextTop } : position));
    }
  }, [isMenuOpen, menuPosition]);

  return (
    <CollapsiblePanel
      title="Snapshots"
      subtitle={`${snapshots.length} saved workspace versions.`}
      expanded={isExpanded}
      onExpandedChange={onExpandedChange}
      actions={
        <div className="snapshot-menu" ref={menuRef}>
          <button
            ref={menuButtonRef}
            className="icon-button snapshot-menu-button"
            type="button"
            title="Snapshot actions"
            aria-label="Snapshot actions"
            aria-expanded={isMenuOpen}
            onClick={(event) => {
              if (!isMenuOpen) {
                setMenuPosition(getMenuPosition(event.currentTarget));
              }
              onMenuToggle();
            }}
          >
            <MoreVertical aria-hidden="true" size={16} />
          </button>
          {isMenuOpen &&
            menuPosition &&
            createPortal(
              <div
                ref={popoverRef}
                className="snapshot-menu-popover"
                role="menu"
                style={{
                  left: `${menuPosition.left}px`,
                  top: `${menuPosition.top}px`,
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
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
              </div>,
              document.body,
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
