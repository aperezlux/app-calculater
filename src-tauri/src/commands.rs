use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::State;
use uuid::Uuid;

use crate::db::Pool;
use crate::models::*;

pub struct AppState {
    pub pool: Pool,
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn hash_pin(pin: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("no se pudo proteger el PIN: {e}"))
}

fn verify_pin_hash(pin: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default().verify_password(pin.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    }
}

fn validate_pin(pin: &str) -> Result<(), String> {
    if pin.len() < 4 || pin.len() > 8 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("El PIN debe tener entre 4 y 8 dígitos.".into());
    }
    Ok(())
}

fn row_to_user(row: &rusqlite::Row) -> rusqlite::Result<UserPublic> {
    Ok(UserPublic {
        id: row.get("id")?,
        name: row.get("name")?,
        created_at: row.get("created_at")?,
        last_login: row.get("last_login")?,
        auto_lock_minutes: row.get("auto_lock_minutes")?,
        theme: row.get("theme")?,
        default_font: row.get("default_font")?,
        default_font_size: row.get("default_font_size")?,
    })
}

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        user_id: row.get("user_id")?,
        folder_id: row.get("folder_id")?,
        title: row.get("title")?,
        content: row.get("content")?,
        is_favorite: row.get::<_, i64>("is_favorite")? != 0,
        is_archived: row.get::<_, i64>("is_archived")? != 0,
        is_deleted: row.get::<_, i64>("is_deleted")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

fn row_to_folder(row: &rusqlite::Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get("id")?,
        user_id: row.get("user_id")?,
        name: row.get("name")?,
        created_at: row.get("created_at")?,
    })
}

// ============================= USERS =============================

#[tauri::command]
pub fn list_users(state: State<AppState>) -> Result<Vec<UserPublic>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM users ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let users = stmt
        .query_map([], row_to_user)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(users)
}

#[tauri::command]
pub fn create_user(state: State<AppState>, name: String, pin: String) -> Result<UserPublic, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre de usuario no puede estar vacío.".into());
    }
    validate_pin(&pin)?;

    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let exists: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM users WHERE name = ?1 COLLATE NOCASE",
            params![name],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if exists.is_some() {
        return Err("Ya existe un usuario con ese nombre.".into());
    }

    let id = Uuid::new_v4().to_string();
    let pin_hash = hash_pin(&pin)?;
    let created_at = now();

    conn.execute(
        "INSERT INTO users (id, name, pin_hash, created_at, auto_lock_minutes, theme, default_font, default_font_size)
         VALUES (?1, ?2, ?3, ?4, 10, 'auto', 'Arial', 16)",
        params![id, name, pin_hash, created_at],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row("SELECT * FROM users WHERE id = ?1", params![id], row_to_user)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn verify_pin(state: State<AppState>, user_id: String, pin: String) -> Result<bool, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let hash: Option<String> = conn
        .query_row("SELECT pin_hash FROM users WHERE id = ?1", params![user_id], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(hash) = hash else { return Err("Usuario no encontrado.".into()) };
    let ok = verify_pin_hash(&pin, &hash);
    if ok {
        conn.execute(
            "UPDATE users SET last_login = ?1 WHERE id = ?2",
            params![now(), user_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(ok)
}

#[tauri::command]
pub fn change_pin(
    state: State<AppState>,
    user_id: String,
    current_pin: String,
    new_pin: String,
) -> Result<(), String> {
    validate_pin(&new_pin)?;
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let hash: String = conn
        .query_row("SELECT pin_hash FROM users WHERE id = ?1", params![user_id], |r| r.get(0))
        .map_err(|_| "Usuario no encontrado.".to_string())?;
    if !verify_pin_hash(&current_pin, &hash) {
        return Err("El PIN actual no es correcto.".into());
    }
    let new_hash = hash_pin(&new_pin)?;
    conn.execute(
        "UPDATE users SET pin_hash = ?1 WHERE id = ?2",
        params![new_hash, user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_user(state: State<AppState>, user_id: String, name: String) -> Result<UserPublic, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre no puede estar vacío.".into());
    }
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let clash: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM users WHERE name = ?1 COLLATE NOCASE AND id != ?2",
            params![name, user_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if clash.is_some() {
        return Err("Ya existe un usuario con ese nombre.".into());
    }
    conn.execute("UPDATE users SET name = ?1 WHERE id = ?2", params![name, user_id])
        .map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM users WHERE id = ?1", params![user_id], row_to_user)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_user_settings(
    state: State<AppState>,
    user_id: String,
    settings: UserSettingsPatch,
) -> Result<UserPublic, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;

    if let Some(minutes) = settings.auto_lock_minutes {
        conn.execute(
            "UPDATE users SET auto_lock_minutes = ?1 WHERE id = ?2",
            params![minutes, user_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(theme) = settings.theme {
        if !["light", "dark", "auto"].contains(&theme.as_str()) {
            return Err("Tema inválido.".into());
        }
        conn.execute("UPDATE users SET theme = ?1 WHERE id = ?2", params![theme, user_id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(font) = settings.default_font {
        conn.execute(
            "UPDATE users SET default_font = ?1 WHERE id = ?2",
            params![font, user_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(size) = settings.default_font_size {
        conn.execute(
            "UPDATE users SET default_font_size = ?1 WHERE id = ?2",
            params![size, user_id],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.query_row("SELECT * FROM users WHERE id = ?1", params![user_id], row_to_user)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_user(state: State<AppState>, user_id: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM users WHERE id = ?1", params![user_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ============================= FOLDERS =============================

#[tauri::command]
pub fn list_folders(state: State<AppState>, user_id: String) -> Result<Vec<Folder>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM folders WHERE user_id = ?1 ORDER BY name COLLATE NOCASE ASC")
        .map_err(|e| e.to_string())?;
    let folders = stmt
        .query_map(params![user_id], row_to_folder)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(folders)
}

#[tauri::command]
pub fn create_folder(state: State<AppState>, user_id: String, name: String) -> Result<Folder, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre de la carpeta no puede estar vacío.".into());
    }
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let clash: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM folders WHERE user_id = ?1 AND name = ?2 COLLATE NOCASE",
            params![user_id, name],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if clash.is_some() {
        return Err("Ya tienes una carpeta con ese nombre.".into());
    }
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO folders (id, user_id, name, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, user_id, name, now()],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM folders WHERE id = ?1", params![id], row_to_folder)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_folder(
    state: State<AppState>,
    user_id: String,
    folder_id: String,
    name: String,
) -> Result<Folder, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre de la carpeta no puede estar vacío.".into());
    }
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let updated = conn
        .execute(
            "UPDATE folders SET name = ?1 WHERE id = ?2 AND user_id = ?3",
            params![name, folder_id, user_id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Carpeta no encontrada.".into());
    }
    conn.query_row("SELECT * FROM folders WHERE id = ?1", params![folder_id], row_to_folder)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_folder(state: State<AppState>, user_id: String, folder_id: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    // Notes are preserved and simply become "sin carpeta" (folder_id -> NULL)
    // via the ON DELETE SET NULL foreign key.
    let deleted = conn
        .execute(
            "DELETE FROM folders WHERE id = ?1 AND user_id = ?2",
            params![folder_id, user_id],
        )
        .map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err("Carpeta no encontrada.".into());
    }
    Ok(())
}

// ============================= NOTES =============================

fn preview_of(content: &str) -> String {
    content.chars().take(200).collect()
}

#[tauri::command]
pub fn list_notes(
    state: State<AppState>,
    user_id: String,
    view: NoteViewUntagged,
) -> Result<Vec<NoteSummary>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let (clause, folder_param): (&str, Option<String>) = match view.0 {
        NoteView::All => ("is_deleted = 0 AND is_archived = 0", None),
        NoteView::Favorites => ("is_deleted = 0 AND is_favorite = 1", None),
        NoteView::Trash => ("is_deleted = 1", None),
        NoteView::Archived => ("is_deleted = 0 AND is_archived = 1", None),
        NoteView::Folder(id) => ("is_deleted = 0 AND folder_id = ?2", Some(id)),
    };

    let sql = format!(
        "SELECT * FROM notes WHERE user_id = ?1 AND {clause} ORDER BY updated_at DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<NoteSummary> {
        let note = row_to_note(row)?;
        Ok(NoteSummary {
            id: note.id,
            folder_id: note.folder_id,
            title: note.title,
            preview: preview_of(&note.content),
            is_favorite: note.is_favorite,
            is_archived: note.is_archived,
            is_deleted: note.is_deleted,
            updated_at: note.updated_at,
        })
    };

    let rows = if let Some(folder_id) = folder_param {
        stmt.query_map(params![user_id, folder_id], map_row)
    } else {
        stmt.query_map(params![user_id], map_row)
    }
    .map_err(|e| e.to_string())?;

    Ok(rows.filter_map(Result::ok).collect())
}

#[tauri::command]
pub fn search_notes(state: State<AppState>, user_id: String, query: String) -> Result<Vec<NoteSummary>, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let like = format!("%{}%", query.replace('%', "\\%"));
    let mut stmt = conn
        .prepare(
            "SELECT n.*, COALESCE(f.name, '') AS folder_name FROM notes n
             LEFT JOIN folders f ON f.id = n.folder_id
             WHERE n.user_id = ?1 AND n.is_deleted = 0
               AND (n.title LIKE ?2 ESCAPE '\\' OR n.content LIKE ?2 ESCAPE '\\' OR f.name LIKE ?2 ESCAPE '\\')
             ORDER BY n.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![user_id, like], |row| {
            let note = row_to_note(row)?;
            Ok(NoteSummary {
                id: note.id,
                folder_id: note.folder_id,
                title: note.title,
                preview: preview_of(&note.content),
                is_favorite: note.is_favorite,
                is_archived: note.is_archived,
                is_deleted: note.is_deleted,
                updated_at: note.updated_at,
            })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.filter_map(Result::ok).collect())
}

fn fetch_owned_note(conn: &rusqlite::Connection, user_id: &str, note_id: &str) -> Result<Note, String> {
    conn.query_row(
        "SELECT * FROM notes WHERE id = ?1 AND user_id = ?2",
        params![note_id, user_id],
        row_to_note,
    )
    .map_err(|_| "Nota no encontrada.".to_string())
}

#[tauri::command]
pub fn get_note(state: State<AppState>, user_id: String, note_id: String) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &note_id)
}

#[tauri::command]
pub fn create_note(
    state: State<AppState>,
    user_id: String,
    folder_id: Option<String>,
) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let ts = now();
    conn.execute(
        "INSERT INTO notes (id, user_id, folder_id, title, content, created_at, updated_at)
         VALUES (?1, ?2, ?3, '', '<p></p>', ?4, ?4)",
        params![id, user_id, folder_id, ts],
    )
    .map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &id)
}

#[tauri::command]
pub fn update_note(
    state: State<AppState>,
    user_id: String,
    note_id: String,
    patch: NotePatch,
) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &note_id)?; // ownership check

    if let Some(title) = &patch.title {
        conn.execute(
            "UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4",
            params![title, now(), note_id, user_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(content) = &patch.content {
        conn.execute(
            "UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4",
            params![content, now(), note_id, user_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(folder_id) = &patch.folder_id {
        conn.execute(
            "UPDATE notes SET folder_id = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4",
            params![folder_id, now(), note_id, user_id],
        )
        .map_err(|e| e.to_string())?;
    }

    fetch_owned_note(&conn, &user_id, &note_id)
}

fn toggle_bool_field(
    state: &State<AppState>,
    user_id: &str,
    note_id: &str,
    field: &str,
) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, user_id, note_id)?;
    let sql = format!(
        "UPDATE notes SET {field} = CASE {field} WHEN 0 THEN 1 ELSE 0 END, updated_at = ?1 WHERE id = ?2 AND user_id = ?3"
    );
    conn.execute(&sql, params![now(), note_id, user_id]).map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, user_id, note_id)
}

#[tauri::command]
pub fn toggle_favorite(state: State<AppState>, user_id: String, note_id: String) -> Result<Note, String> {
    toggle_bool_field(&state, &user_id, &note_id, "is_favorite")
}

#[tauri::command]
pub fn toggle_archive(state: State<AppState>, user_id: String, note_id: String) -> Result<Note, String> {
    toggle_bool_field(&state, &user_id, &note_id, "is_archived")
}

#[tauri::command]
pub fn trash_note(state: State<AppState>, user_id: String, note_id: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &note_id)?;
    conn.execute(
        "UPDATE notes SET is_deleted = 1, deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3",
        params![now(), note_id, user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_note(state: State<AppState>, user_id: String, note_id: String) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &note_id)?;
    conn.execute(
        "UPDATE notes SET is_deleted = 0, deleted_at = NULL, updated_at = ?1 WHERE id = ?2 AND user_id = ?3",
        params![now(), note_id, user_id],
    )
    .map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &note_id)
}

#[tauri::command]
pub fn delete_note_forever(state: State<AppState>, user_id: String, note_id: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &note_id)?;
    conn.execute(
        "DELETE FROM notes WHERE id = ?1 AND user_id = ?2",
        params![note_id, user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn empty_trash(state: State<AppState>, user_id: String) -> Result<(), String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM notes WHERE user_id = ?1 AND is_deleted = 1",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn duplicate_note(state: State<AppState>, user_id: String, note_id: String) -> Result<Note, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let original = fetch_owned_note(&conn, &user_id, &note_id)?;
    let new_id = Uuid::new_v4().to_string();
    let ts = now();
    let new_title = if original.title.is_empty() {
        "Copia".to_string()
    } else {
        format!("{} (copia)", original.title)
    };
    conn.execute(
        "INSERT INTO notes (id, user_id, folder_id, title, content, is_favorite, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![new_id, user_id, original.folder_id, new_title, original.content, original.is_favorite as i64, ts],
    )
    .map_err(|e| e.to_string())?;
    fetch_owned_note(&conn, &user_id, &new_id)
}

// ============================= BACKUP =============================

#[tauri::command]
pub fn export_backup(state: State<AppState>, user_id: String) -> Result<String, String> {
    let conn = state.pool.get().map_err(|e| e.to_string())?;
    let user_name: String = conn
        .query_row("SELECT name FROM users WHERE id = ?1", params![user_id], |r| r.get(0))
        .map_err(|_| "Usuario no encontrado.".to_string())?;

    let mut folder_stmt = conn
        .prepare("SELECT * FROM folders WHERE user_id = ?1")
        .map_err(|e| e.to_string())?;
    let folders: Vec<Folder> = folder_stmt
        .query_map(params![user_id], row_to_folder)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    let mut note_stmt = conn
        .prepare("SELECT * FROM notes WHERE user_id = ?1")
        .map_err(|e| e.to_string())?;
    let notes: Vec<Note> = note_stmt
        .query_map(params![user_id], row_to_note)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    let backup = BackupFile {
        format_version: 1,
        exported_at: now(),
        user_name,
        folders,
        notes,
    };
    serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
}

#[tauri::command]
pub fn import_backup(
    state: State<AppState>,
    user_id: String,
    json: String,
    overwrite: bool,
) -> Result<ImportResult, String> {
    let backup: BackupFile = serde_json::from_str(&json).map_err(|_| {
        "El archivo de respaldo no es válido o está dañado.".to_string()
    })?;

    let mut conn = state.pool.get().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Folders: re-create under the current user, remapping old id -> new id
    // (folder ids from a backup could collide across computers).
    let mut folder_id_map = std::collections::HashMap::new();
    for f in &backup.folders {
        let existing: Option<String> = tx
            .query_row(
                "SELECT id FROM folders WHERE user_id = ?1 AND name = ?2 COLLATE NOCASE",
                params![user_id, f.name],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let new_id = if let Some(id) = existing {
            id
        } else {
            let id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO folders (id, user_id, name, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![id, user_id, f.name, now()],
            )
            .map_err(|e| e.to_string())?;
            id
        };
        folder_id_map.insert(f.id.clone(), new_id);
    }

    let mut imported = 0usize;
    let skipped = 0usize; // reserved for future validation-based skips

    for n in &backup.notes {
        let mapped_folder = n.folder_id.as_ref().and_then(|fid| folder_id_map.get(fid).cloned());

        let existing: Option<i64> = tx
            .query_row(
                "SELECT 1 FROM notes WHERE id = ?1 AND user_id = ?2",
                params![n.id, user_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        if existing.is_some() && !overwrite {
            // Import as a new note instead of silently dropping content.
            let new_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO notes (id, user_id, folder_id, title, content, is_favorite, is_archived, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
                params![new_id, user_id, mapped_folder, n.title, n.content, n.is_favorite as i64, n.is_archived as i64, now()],
            )
            .map_err(|e| e.to_string())?;
            imported += 1;
        } else if existing.is_some() && overwrite {
            tx.execute(
                "UPDATE notes SET title = ?1, content = ?2, folder_id = ?3, is_favorite = ?4, is_archived = ?5, updated_at = ?6
                 WHERE id = ?7 AND user_id = ?8",
                params![n.title, n.content, mapped_folder, n.is_favorite as i64, n.is_archived as i64, now(), n.id, user_id],
            )
            .map_err(|e| e.to_string())?;
            imported += 1;
        } else {
            tx.execute(
                "INSERT INTO notes (id, user_id, folder_id, title, content, is_favorite, is_archived, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
                params![n.id, user_id, mapped_folder, n.title, n.content, n.is_favorite as i64, n.is_archived as i64, now()],
            )
            .map_err(|e| e.to_string())?;
            imported += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(ImportResult { imported, skipped })
}
