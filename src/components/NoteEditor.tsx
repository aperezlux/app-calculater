import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "../types";
import { AVAILABLE_FONTS } from "../types";

interface Props {
  note: Note;
  defaultFont: string;
  defaultFontSize: number;
  onSave: (patch: { title?: string; content?: string }) => Promise<void>;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onTrash: () => void;
  onDuplicate: () => void;
  onExportNote: (format: "txt" | "md") => void;
  isTrashed: boolean;
  onRestore: () => void;
  onDeleteForever: () => void;
}

type SaveStatus = "saved" | "saving" | "pending";

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

export function NoteEditor(props: Props) {
  const { note } = props;
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [font, setFont] = useState(props.defaultFont);
  const [fontSize, setFontSize] = useState(props.defaultFontSize);
  const debounceRef = useRef<number | undefined>(undefined);
  const pendingPatchRef = useRef<{ title?: string; content?: string }>({});

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
    ],
    content: note.content,
    onUpdate: ({ editor }) => {
      queueSave({ content: editor.getHTML() });
    },
  });

  // Reload editor content and title whenever a different note is opened.
  useEffect(() => {
    setTitle(note.title);
    editor?.commands.setContent(note.content || "<p></p>");
    setStatus("saved");
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    const patch = pendingPatchRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatchRef.current = {};
    setStatus("saving");
    try {
      await props.onSave(patch);
    } finally {
      setStatus("saved");
    }
  }, [props]);

  function queueSave(patch: { title?: string; content?: string }) {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    setStatus("pending");
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(flush, 600);
  }

  // Flush on unmount / note switch so nothing is lost.
  useEffect(() => {
    return () => {
      window.clearTimeout(debounceRef.current);
      flush();
    };
  }, [note.id, flush]);

  // Ctrl+S forces an immediate save instead of waiting for the debounce.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        window.clearTimeout(debounceRef.current);
        flush();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flush]);

  if (!editor) return null;

  return (
    <section className="note-editor">
      <div className="note-editor-header">
        <input
          className="note-title-input"
          value={title}
          placeholder="Sin título"
          onChange={(e) => {
            setTitle(e.target.value);
            queueSave({ title: e.target.value });
          }}
        />
        <span className={`save-indicator save-indicator-${status}`}>
          {status === "saving" && "Guardando..."}
          {status === "pending" && "Cambios sin guardar"}
          {status === "saved" && "Guardado"}
        </span>
      </div>

      {props.isTrashed ? (
        <div className="trash-banner">
          <span>Esta nota está en la papelera.</span>
          <button className="btn btn-ghost btn-small" onClick={props.onRestore}>
            Restaurar
          </button>
          <button
            className="btn btn-ghost btn-small btn-danger-text"
            onClick={() => {
              if (confirm("Esta nota se eliminará definitivamente. ¿Continuar?")) {
                props.onDeleteForever();
              }
            }}
          >
            Eliminar definitivamente
          </button>
        </div>
      ) : (
        <>
          <div className="editor-toolbar">
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              title="Tipo de letra"
              className="toolbar-select"
            >
              {AVAILABLE_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              title="Tamaño de letra"
              className="toolbar-select toolbar-select-narrow"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="toolbar-divider" />

            <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="N" title="Negrita (Ctrl+B)" />
            <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" title="Cursiva (Ctrl+I)" italic />
            <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="S" title="Subrayado (Ctrl+U)" underline />
            <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} label="T" title="Tachado" strike />

            <input
              type="color"
              className="toolbar-color"
              title="Color de texto"
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            />
            <input
              type="color"
              className="toolbar-color"
              title="Resaltado"
              defaultValue="#fff2a8"
              onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
            />

            <div className="toolbar-divider" />

            <ToolbarButton active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} label="⟸" title="Alinear a la izquierda" />
            <ToolbarButton active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} label="⟺" title="Centrado" />
            <ToolbarButton active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} label="⟹" title="Alinear a la derecha" />
            <ToolbarButton active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} label="≡" title="Justificado" />

            <div className="toolbar-divider" />

            <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="•" title="Lista con viñetas" />
            <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1." title="Lista numerada" />
            <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H" title="Encabezado" />
            <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="❝" title="Cita" />
            <ToolbarButton
              active={editor.isActive("link")}
              onClick={() => {
                const url = window.prompt("URL del enlace");
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
              label="🔗"
              title="Enlace"
            />
          </div>

          <div
            className="editor-surface"
            style={{ fontFamily: font, fontSize: `${fontSize}px` }}
            onClick={() => editor.chain().focus().run()}
          >
            <EditorContent editor={editor} />
          </div>

          <div className="note-editor-footer">
            <button className="text-btn" onClick={props.onToggleFavorite}>
              {note.isFavorite ? "★ Quitar de favoritas" : "☆ Marcar favorita"}
            </button>
            <button className="text-btn" onClick={props.onToggleArchive}>
              {note.isArchived ? "Desarchivar" : "Archivar"}
            </button>
            <button className="text-btn" onClick={props.onDuplicate}>
              Duplicar
            </button>
            <button className="text-btn" onClick={() => props.onExportNote("md")}>
              Exportar .md
            </button>
            <button className="text-btn" onClick={() => props.onExportNote("txt")}>
              Exportar .txt
            </button>
            <button className="text-btn text-btn-danger" onClick={props.onTrash}>
              Eliminar
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  title,
  italic,
  underline,
  strike,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}) {
  return (
    <button
      type="button"
      className={`toolbar-btn ${active ? "toolbar-btn-active" : ""}`}
      onClick={onClick}
      title={title}
      style={{
        fontStyle: italic ? "italic" : undefined,
        textDecoration: underline ? "underline" : strike ? "line-through" : undefined,
      }}
    >
      {label}
    </button>
  );
}
