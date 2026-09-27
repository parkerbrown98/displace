mod commands;
mod credentials;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::clear_refresh_token,
            commands::collect_diagnostics,
            commands::get_app_metadata,
            commands::has_refresh_token,
            commands::store_refresh_token,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Displace desktop");
}
