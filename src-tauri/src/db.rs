use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;
use tauri::Manager;

pub type Pool = r2d2::Pool<SqliteConnectionManager>;

/// Data lives under the OS-appropriate per-user app-data directory, e.g. on
/// Windows: %APPDATA%\com.notaslocales.app\notas-locales.sqlite3
/// This is intentionally NOT inside the install directory, so updates or
/// reinstalls never touch it and don't need elevated permissions to write.
pub fn resolve_db_path(app: &tauri::App) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("no se pudo resolver el directorio de datos de la aplicación");
    std::fs::create_dir_all(&dir).expect("no se pudo crear el directorio de datos");
    dir.join("notas-locales.sqlite3")
}

pub fn init_pool(db_path: &PathBuf) -> Pool {
    let manager = SqliteConnectionManager::file(db_path).with_init(|conn| {
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
    });
    let pool = Pool::new(manager).expect("no se pudo crear el pool de conexiones SQLite");
    migrate(&pool);
    pool
}

fn migrate(pool: &Pool) {
    let conn = pool.get().expect("no se pudo obtener una conexión");
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL UNIQUE COLLATE NOCASE,
            pin_hash            TEXT NOT NULL,
            created_at          TEXT NOT NULL,
            last_login          TEXT,
            auto_lock_minutes   INTEGER,
            theme               TEXT NOT NULL DEFAULT 'auto',
            default_font        TEXT NOT NULL DEFAULT 'Arial',
            default_font_size   INTEGER NOT NULL DEFAULT 16
        );

        CREATE TABLE IF NOT EXISTS folders (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notes (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
            title       TEXT NOT NULL DEFAULT '',
            content     TEXT NOT NULL DEFAULT '',
            is_favorite INTEGER NOT NULL DEFAULT 0,
            is_archived INTEGER NOT NULL DEFAULT 0,
            is_deleted  INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            deleted_at  TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, is_deleted, is_archived);
        CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
        CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
        "#,
    )
    .expect("fallo al aplicar las migraciones de la base de datos");
}
