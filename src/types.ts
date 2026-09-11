export type ThemePref = "light" | "dark" | "auto";

export type AutoLockMinutes = number | null; // null = "Nunca"

export interface UserPublic {
  id: string;
  name: string;
  createdAt: string;
  lastLogin: string | null;
  autoLockMinutes: AutoLockMinutes;
  theme: ThemePref;
  defaultFont: string;
  defaultFontSize: number;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  content: string; // HTML from the rich text editor
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NoteSummary {
  id: string;
  folderId: string | null;
  title: string;
  preview: string;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  updatedAt: string;
}

export const AVAILABLE_FONTS = [
  "Arial",
  "Calibri",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Courier New",
  "Consolas",
  "Comic Sans MS",
] as const;

export type AvailableFont = (typeof AVAILABLE_FONTS)[number];

export const AUTO_LOCK_PRESETS: { label: string; minutes: AutoLockMinutes }[] = [
  { label: "Nunca", minutes: null },
  { label: "1 minuto", minutes: 1 },
  { label: "2 minutos", minutes: 2 },
  { label: "5 minutos", minutes: 5 },
  { label: "10 minutos", minutes: 10 },
  { label: "15 minutos", minutes: 15 },
  { label: "30 minutos", minutes: 30 },
  { label: "1 hora", minutes: 60 },
];
