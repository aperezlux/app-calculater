use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPublic {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub last_login: Option<String>,
    pub auto_lock_minutes: Option<i64>,
    pub theme: String,
    pub default_font: String,
    pub default_font_size: i64,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettingsPatch {
    pub auto_lock_minutes: Option<Option<i64>>,
    pub theme: Option<String>,
    pub default_font: Option<String>,
    pub default_font_size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub user_id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub content: String,
    pub is_favorite: bool,
    pub is_archived: bool,
    pub is_deleted: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub preview: String,
    pub is_favorite: bool,
    pub is_archived: bool,
    pub is_deleted: bool,
    pub updated_at: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotePatch {
    pub title: Option<String>,
    pub content: Option<String>,
    pub folder_id: Option<Option<String>>,
}

#[derive(Debug)]
pub enum NoteView {
    All,
    Favorites,
    Trash,
    Archived,
    Folder(String),
}

pub struct NoteViewUntagged(pub NoteView);

// The frontend sends either the string "all" / "favorites" / "trash" /
// "archived", or the object { folderId: "..." } — this deserializer accepts
// both shapes into the same NoteView enum.
impl<'de> serde::de::Deserialize<'de> for NoteViewUntagged {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Raw {
            Tag(String),
            Folder { #[serde(rename = "folderId")] folder_id: String },
        }
        let raw = Raw::deserialize(deserializer)?;
        Ok(match raw {
            Raw::Tag(t) => match t.as_str() {
                "all" => NoteViewUntagged(NoteView::All),
                "favorites" => NoteViewUntagged(NoteView::Favorites),
                "trash" => NoteViewUntagged(NoteView::Trash),
                "archived" => NoteViewUntagged(NoteView::Archived),
                other => NoteViewUntagged(NoteView::Folder(other.to_string())),
            },
            Raw::Folder { folder_id } => NoteViewUntagged(NoteView::Folder(folder_id)),
        })
    }
}

// Backup file format for export/import.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub format_version: u32,
    pub exported_at: String,
    pub user_name: String,
    pub folders: Vec<Folder>,
    pub notes: Vec<Note>,
}
