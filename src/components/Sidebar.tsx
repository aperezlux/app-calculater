import { useState } from "react";
import type { Folder, UserPublic } from "../types";

export type ViewKey = "all" | "favorites" | "trash" | "archived" | { folderId: string };

interface Props {
  user: UserPublic;
  folders: Folder[];
  activeView: ViewKey;
  onSelectView: (v: ViewKey) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

function isSameView(a: ViewKey, b: ViewKey) {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.folderId === b.folderId;
}

export function Sidebar(props: Props) {
  const { user, folders, activeView, onSelectView } = props;
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function submitNewFolder() {
    const name = newFolderName.trim();
    if (name) props.onCreateFolder(name);
    setNewFolderName("");
    setAddingFolder(false);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <button
          className={`nav-item ${isSameView(activeView, "all") ? "nav-item-active" : ""}`}
          onClick={() => onSelectView("all")}
        >
          Todas las notas
        </button>
        <button
          className={`nav-item ${isSameView(activeView, "favorites") ? "nav-item-active" : ""}`}
          onClick={() => onSelectView("favorites")}
        >
          Favoritas
        </button>
        <button
          className={`nav-item ${isSameView(activeView, "archived") ? "nav-item-active" : ""}`}
          onClick={() => onSelectView("archived")}
        >
          Archivadas
        </button>
        <button
          className={`nav-item ${isSameView(activeView, "trash") ? "nav-item-active" : ""}`}
          onClick={() => onSelectView("trash")}
        >
          Papelera
        </button>
      </div>

      <div className="sidebar-section sidebar-folders">
        <div className="sidebar-heading">
          <span>Carpetas</span>
          <button className="icon-btn" title="Nueva carpeta" onClick={() => setAddingFolder(true)}>
            +
          </button>
        </div>

        {folders.map((f) =>
          editingFolderId === f.id ? (
            <form
              key={f.id}
              onSubmit={(e) => {
                e.preventDefault();
                if (editingName.trim()) props.onRenameFolder(f.id, editingName.trim());
                setEditingFolderId(null);
              }}
            >
              <input
                autoFocus
                className="folder-rename-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => setEditingFolderId(null)}
              />
            </form>
          ) : (
            <div
              key={f.id}
              className={`nav-item nav-item-folder ${
                isSameView(activeView, { folderId: f.id }) ? "nav-item-active" : ""
              }`}
              onClick={() => onSelectView({ folderId: f.id })}
              onDoubleClick={() => {
                setEditingFolderId(f.id);
                setEditingName(f.name);
              }}
              title="Doble clic para renombrar"
            >
              <span className="folder-name">{f.name}</span>
              <button
                className="icon-btn icon-btn-danger"
                title="Eliminar carpeta"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar la carpeta "${f.name}"? Las notas no se borrarán.`)) {
                    props.onDeleteFolder(f.id);
                  }
                }}
              >
                ×
              </button>
            </div>
          )
        )}

        {addingFolder && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitNewFolder();
            }}
          >
            <input
              autoFocus
              className="folder-rename-input"
              placeholder="Nombre de la carpeta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={submitNewFolder}
            />
          </form>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={props.onOpenSettings}>
          Configuración
        </button>
        <div className="current-user">
          <span className="user-avatar user-avatar-sm">{user.name.charAt(0).toUpperCase()}</span>
          <span className="user-name-small">{user.name}</span>
        </div>
        <button className="btn btn-ghost btn-block" onClick={props.onLogout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
