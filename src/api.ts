import { invoke } from "@tauri-apps/api/core";
import type { AutoLockMinutes, Folder, Note, NoteSummary, ThemePref, UserPublic } from "./types";

/**
 * Thin wrapper around every Tauri command exposed by src-tauri/src/commands.rs.
 * Every function that touches user data requires userId, and the Rust side
 * re-validates ownership on every row before returning or mutating it —
 * the frontend check is a UX nicety, not the security boundary.
 */

export const api = {
  // ---- Users ----
  listUsers: () => invoke<UserPublic[]>("list_users"),

  createUser: (name: string, pin: string) =>
    invoke<UserPublic>("create_user", { name, pin }),

  verifyPin: (userId: string, pin: string) =>
    invoke<boolean>("verify_pin", { userId, pin }),

  changePin: (userId: string, currentPin: string, newPin: string) =>
    invoke<void>("change_pin", { userId, currentPin, newPin }),

  renameUser: (userId: string, name: string) =>
    invoke<UserPublic>("rename_user", { userId, name }),

  updateUserSettings: (
    userId: string,
    settings: Partial<{
      autoLockMinutes: AutoLockMinutes;
      theme: ThemePref;
      defaultFont: string;
      defaultFontSize: number;
    }>
  ) => invoke<UserPublic>("update_user_settings", { userId, settings }),

  deleteUser: (userId: string) => invoke<void>("delete_user", { userId }),

  // ---- Folders ----
  listFolders: (userId: string) => invoke<Folder[]>("list_folders", { userId }),

  createFolder: (userId: string, name: string) =>
    invoke<Folder>("create_folder", { userId, name }),

  renameFolder: (userId: string, folderId: string, name: string) =>
    invoke<Folder>("rename_folder", { userId, folderId, name }),

  deleteFolder: (userId: string, folderId: string) =>
    invoke<void>("delete_folder", { userId, folderId }),

  // ---- Notes ----
  listNotes: (
    userId: string,
    view: "all" | "favorites" | "trash" | "archived" | { folderId: string }
  ) => invoke<NoteSummary[]>("list_notes", { userId, view }),

  searchNotes: (userId: string, query: string) =>
    invoke<NoteSummary[]>("search_notes", { userId, query }),

  getNote: (userId: string, noteId: string) => invoke<Note>("get_note", { userId, noteId }),

  createNote: (userId: string, folderId: string | null) =>
    invoke<Note>("create_note", { userId, folderId }),

  updateNote: (
    userId: string,
    noteId: string,
    patch: Partial<{ title: string; content: string; folderId: string | null }>
  ) => invoke<Note>("update_note", { userId, noteId, patch }),

  toggleFavorite: (userId: string, noteId: string) =>
    invoke<Note>("toggle_favorite", { userId, noteId }),

  toggleArchive: (userId: string, noteId: string) =>
    invoke<Note>("toggle_archive", { userId, noteId }),

  trashNote: (userId: string, noteId: string) => invoke<void>("trash_note", { userId, noteId }),

  restoreNote: (userId: string, noteId: string) =>
    invoke<Note>("restore_note", { userId, noteId }),

  deleteNoteForever: (userId: string, noteId: string) =>
    invoke<void>("delete_note_forever", { userId, noteId }),

  emptyTrash: (userId: string) => invoke<void>("empty_trash", { userId }),

  duplicateNote: (userId: string, noteId: string) =>
    invoke<Note>("duplicate_note", { userId, noteId }),

  // ---- Backup ----
  exportBackup: (userId: string) => invoke<string>("export_backup", { userId }),

  importBackup: (userId: string, json: string, overwrite: boolean) =>
    invoke<{ imported: number; skipped: number }>("import_backup", {
      userId,
      json,
      overwrite,
    }),
};
