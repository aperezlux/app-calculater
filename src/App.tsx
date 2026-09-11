import { useCallback, useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { UserSelect } from "./components/UserSelect";
import { PinScreen } from "./components/PinScreen";
import { CreateUserModal } from "./components/CreateUserModal";
import { Sidebar, type ViewKey } from "./components/Sidebar";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { useSessionTimer } from "./useSessionTimer";
import { api } from "./api";
import type { Folder, Note, NoteSummary, UserPublic } from "./types";

type Stage =
  | { kind: "select" }
  | { kind: "pin"; user: UserPublic }
  | { kind: "workspace"; user: UserPublic };

function useEffectiveTheme(theme: UserPublic["theme"] | undefined) {
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!theme || theme === "auto") return systemPrefersDark ? "dark" : "light";
  return theme;
}

function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText;
}

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: "select" });
  const [userSelectRefresh, setUserSelectRefresh] = useState(0);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [view, setView] = useState<ViewKey>("all");
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [query, setQuery] = useState("");

  const currentUser = stage.kind === "workspace" ? stage.user : null;
  const effectiveTheme = useEffectiveTheme(currentUser?.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const returnToSelect = useCallback(() => {
    setActiveNote(null);
    setNotes([]);
    setFolders([]);
    setShowSettings(false);
    setUserSelectRefresh((k) => k + 1);
    setStage({ kind: "select" });
  }, []);

  // Per-user inactivity timer. Only active while a workspace session is open.
  // On timeout it only returns to the user-select screen — the window/app
  // stays exactly as it is otherwise.
  useSessionTimer(currentUser?.autoLockMinutes ?? null, stage.kind === "workspace", () => {
    returnToSelect();
  });

  const refreshFolders = useCallback(async (userId: string) => {
    setFolders(await api.listFolders(userId));
  }, []);

  const refreshNotes = useCallback(async (userId: string, v: ViewKey, q: string) => {
    const list = q.trim() ? await api.searchNotes(userId, q.trim()) : await api.listNotes(userId, v);
    setNotes(list);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    refreshFolders(currentUser.id);
  }, [currentUser?.id, refreshFolders]);

  useEffect(() => {
    if (!currentUser) return;
    refreshNotes(currentUser.id, view, query);
  }, [currentUser?.id, view, query, refreshNotes]);

  async function openNote(id: string) {
    if (!currentUser) return;
    const note = await api.getNote(currentUser.id, id);
    setActiveNote(note);
  }

  async function handleNewNote() {
    if (!currentUser) return;
    const folderId = typeof view === "object" ? view.folderId : null;
    const note = await api.createNote(currentUser.id, folderId);
    await refreshNotes(currentUser.id, view, query);
    setActiveNote(note);
  }

  async function handleSaveNote(patch: { title?: string; content?: string }) {
    if (!currentUser || !activeNote) return;
    const updated = await api.updateNote(currentUser.id, activeNote.id, patch);
    setActiveNote(updated);
    await refreshNotes(currentUser.id, view, query);
  }

  // Global shortcuts that make sense app-wide, on top of the editor's own
  // Ctrl+B/I/U (handled natively by Tiptap) and Ctrl+S (handled in NoteEditor).
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (stage.kind !== "workspace") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewNote();
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search-input")?.focus();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        returnToSelect();
      } else if (e.key === "Escape") {
        setShowSettings(false);
        setShowCreateUser(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage.kind, returnToSelect]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExportNote(format: "txt" | "md") {
    if (!activeNote) return;
    const content =
      format === "txt"
        ? htmlToPlainText(activeNote.content)
        : `# ${activeNote.title || "Sin título"}\n\n${htmlToPlainText(activeNote.content)}`;
    const path = await save({
      defaultPath: `${activeNote.title || "nota"}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (path) await writeTextFile(path, content);
  }

  if (stage.kind === "select") {
    return (
      <>
        <UserSelect
          refreshKey={userSelectRefresh}
          onPickUser={(user) => setStage({ kind: "pin", user })}
          onCreateUser={() => setShowCreateUser(true)}
        />
        {showCreateUser && (
          <CreateUserModal
            onClose={() => setShowCreateUser(false)}
            onCreated={(user) => {
              setShowCreateUser(false);
              setStage({ kind: "workspace", user });
            }}
          />
        )}
      </>
    );
  }

  if (stage.kind === "pin") {
    return (
      <PinScreen
        user={stage.user}
        onBack={() => setStage({ kind: "select" })}
        onSuccess={() => setStage({ kind: "workspace", user: stage.user })}
      />
    );
  }

  // workspace
  return (
    <div className="workspace">
      <Sidebar
        user={stage.user}
        folders={folders}
        activeView={view}
        onSelectView={(v) => {
          setActiveNote(null);
          setQuery("");
          setView(v);
        }}
        onCreateFolder={async (name) => {
          await api.createFolder(stage.user.id, name);
          await refreshFolders(stage.user.id);
        }}
        onRenameFolder={async (id, name) => {
          await api.renameFolder(stage.user.id, id, name);
          await refreshFolders(stage.user.id);
        }}
        onDeleteFolder={async (id) => {
          await api.deleteFolder(stage.user.id, id);
          await refreshFolders(stage.user.id);
          if (typeof view === "object" && view.folderId === id) setView("all");
        }}
        onOpenSettings={() => setShowSettings(true)}
        onLogout={returnToSelect}
      />

      <NoteList
        view={view}
        notes={notes}
        activeNoteId={activeNote?.id ?? null}
        query={query}
        onQueryChange={setQuery}
        onSelectNote={openNote}
        onNewNote={handleNewNote}
        onEmptyTrash={async () => {
          await api.emptyTrash(stage.user.id);
          await refreshNotes(stage.user.id, view, query);
        }}
      />

      {activeNote ? (
        <NoteEditor
          key={activeNote.id}
          note={activeNote}
          defaultFont={stage.user.defaultFont}
          defaultFontSize={stage.user.defaultFontSize}
          isTrashed={activeNote.isDeleted}
          onSave={handleSaveNote}
          onExportNote={handleExportNote}
          onToggleFavorite={async () => {
            const updated = await api.toggleFavorite(stage.user.id, activeNote.id);
            setActiveNote(updated);
            await refreshNotes(stage.user.id, view, query);
          }}
          onToggleArchive={async () => {
            const updated = await api.toggleArchive(stage.user.id, activeNote.id);
            setActiveNote(updated);
            await refreshNotes(stage.user.id, view, query);
          }}
          onDuplicate={async () => {
            const dup = await api.duplicateNote(stage.user.id, activeNote.id);
            await refreshNotes(stage.user.id, view, query);
            setActiveNote(dup);
          }}
          onTrash={async () => {
            await api.trashNote(stage.user.id, activeNote.id);
            setActiveNote(null);
            await refreshNotes(stage.user.id, view, query);
          }}
          onRestore={async () => {
            const restored = await api.restoreNote(stage.user.id, activeNote.id);
            setActiveNote(restored);
            await refreshNotes(stage.user.id, view, query);
          }}
          onDeleteForever={async () => {
            await api.deleteNoteForever(stage.user.id, activeNote.id);
            setActiveNote(null);
            await refreshNotes(stage.user.id, view, query);
          }}
        />
      ) : (
        <section className="note-editor note-editor-empty">
          <p>Selecciona una nota o crea una nueva para empezar a escribir.</p>
        </section>
      )}

      {showSettings && (
        <SettingsPanel
          user={stage.user}
          onClose={() => setShowSettings(false)}
          onUserUpdated={(u) => setStage({ kind: "workspace", user: u })}
          onUserDeleted={returnToSelect}
        />
      )}
    </div>
  );
}
