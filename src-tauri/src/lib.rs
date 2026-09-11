mod commands;
mod db;
mod models;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let db_path = db::resolve_db_path(app);
            let pool = db::init_pool(&db_path);
            app.manage(AppState { pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_users,
            commands::create_user,
            commands::verify_pin,
            commands::change_pin,
            commands::rename_user,
            commands::update_user_settings,
            commands::delete_user,
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
            commands::list_notes,
            commands::search_notes,
            commands::get_note,
            commands::create_note,
            commands::update_note,
            commands::toggle_favorite,
            commands::toggle_archive,
            commands::trash_note,
            commands::restore_note,
            commands::delete_note_forever,
            commands::empty_trash,
            commands::duplicate_note,
            commands::export_backup,
            commands::import_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Notas Locales");
}
