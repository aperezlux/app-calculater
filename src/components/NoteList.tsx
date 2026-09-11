import type { NoteSummary } from "../types";
import type { ViewKey } from "./Sidebar";

interface Props {
  view: ViewKey;
  notes: NoteSummary[];
  activeNoteId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onEmptyTrash: () => void;
}

function viewTitle(view: ViewKey): string {
  if (view === "all") return "Todas las notas";
  if (view === "favorites") return "Favoritas";
  if (view === "archived") return "Archivadas";
  if (view === "trash") return "Papelera";
  return "Carpeta";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

export function NoteList(props: Props) {
  const { view, notes } = props;

  return (
    <section className="note-list">
      <div className="note-list-header">
        <h2>{viewTitle(view)}</h2>
        {view !== "trash" && (
          <button className="btn btn-primary btn-small" onClick={props.onNewNote}>
            + Nueva
          </button>
        )}
        {view === "trash" && notes.length > 0 && (
          <button className="btn btn-ghost btn-small" onClick={props.onEmptyTrash}>
            Vaciar papelera
          </button>
        )}
      </div>

      <input
        className="search-input"
        placeholder="Buscar por título, contenido o carpeta"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
      />

      <div className="note-list-items">
        {notes.length === 0 && (
          <p className="empty-hint">
            {view === "trash" ? "La papelera está vacía." : "No hay notas aquí todavía."}
          </p>
        )}
        {notes.map((n) => (
          <button
            key={n.id}
            className={`note-card ${props.activeNoteId === n.id ? "note-card-active" : ""}`}
            onClick={() => props.onSelectNote(n.id)}
          >
            <div className="note-card-title-row">
              {n.isFavorite && <span className="note-star" aria-label="Favorita">★</span>}
              <span className="note-card-title">{n.title || "Sin título"}</span>
            </div>
            <p className="note-card-preview">{stripHtml(n.preview)}</p>
            <span className="note-card-date">{formatDate(n.updatedAt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
