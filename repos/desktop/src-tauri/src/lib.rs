mod commands;
mod credentials;
mod native_auth;
mod oidc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        use tauri::Manager;
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            },
        ));
    }
    builder
        .manage(native_auth::NativeAuthState::default())
        .manage(oidc::OidcTransactionStore::default())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::collect_diagnostics,
            commands::get_app_metadata,
            native_auth::clear_refresh_token,
            native_auth::has_refresh_token,
            native_auth::refresh_authentication,
            native_auth::store_refresh_token,
            oidc::begin_oidc_transaction,
            oidc::complete_oidc_authentication,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Displace desktop");
}
