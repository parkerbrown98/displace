use serde::Serialize;

use crate::credentials;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppMetadata {
    architecture: &'static str,
    name: String,
    platform: &'static str,
    version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSnapshot {
    #[serde(flatten)]
    app: AppMetadata,
    secure_storage_available: bool,
}

#[tauri::command]
pub fn clear_refresh_token() -> Result<(), String> {
    credentials::clear_refresh_token().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn has_refresh_token() -> Result<bool, String> {
    credentials::has_refresh_token().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn store_refresh_token(refresh_token: String) -> Result<(), String> {
    credentials::store_refresh_token(&refresh_token).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_app_metadata(app: tauri::AppHandle) -> AppMetadata {
    app_metadata(&app)
}

#[tauri::command]
pub fn collect_diagnostics(app: tauri::AppHandle) -> DiagnosticSnapshot {
    DiagnosticSnapshot {
        app: app_metadata(&app),
        secure_storage_available: credentials::has_refresh_token().is_ok(),
    }
}

fn app_metadata(app: &tauri::AppHandle) -> AppMetadata {
    let package = app.package_info();
    AppMetadata {
        architecture: std::env::consts::ARCH,
        name: package.name.clone(),
        platform: std::env::consts::OS,
        version: package.version.to_string(),
    }
}
