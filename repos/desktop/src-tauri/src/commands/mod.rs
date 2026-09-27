use serde::Serialize;

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
pub fn get_app_metadata(app: tauri::AppHandle) -> AppMetadata {
    app_metadata(&app)
}

#[tauri::command]
pub async fn collect_diagnostics(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::native_auth::NativeAuthState>,
) -> Result<DiagnosticSnapshot, String> {
    let _guard = state.lock().await;
    Ok(DiagnosticSnapshot {
        app: app_metadata(&app),
        secure_storage_available: crate::credentials::has_refresh_token().is_ok(),
    })
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
