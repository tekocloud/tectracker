#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{params, Connection};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
async fn export_file(app: tauri::AppHandle, name: String, data: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = app
            .dialog()
            .file()
            .set_file_name(&name)
            .blocking_save_file();
        if let Some(file) = path {
            let path = file.into_path().map_err(|e| e.to_string())?;
            std::fs::write(path, data).map_err(|e| e.to_string())?;
            Ok(true)
        } else {
            Ok(false)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
struct Db(Mutex<Connection>);
#[tauri::command]
fn backup_state(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    std::fs::write(dir.join(format!("before-restore-{stamp}.json")), data)
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn load_state(db: tauri::State<Db>) -> Result<Option<String>, String> {
    let c = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = c
        .prepare("SELECT data FROM state WHERE id=1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    Ok(rows
        .next()
        .map_err(|e| e.to_string())?
        .map(|r| r.get(0))
        .transpose()
        .map_err(|e| e.to_string())?)
}
#[tauri::command]
fn save_state(db: tauri::State<Db>, data: String) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    if value["version"] != 1 {
        return Err("Unsupported data version".into());
    }
    let mut c = db.0.lock().map_err(|e| e.to_string())?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO state(id,data) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        params![data],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
fn main() {
    tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app,_,_|{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}})).plugin(tauri_plugin_dialog::init()).setup(|app|{let dir=app.path().app_data_dir()?;std::fs::create_dir_all(&dir)?;let conn=Connection::open(dir.join("tectracker.sqlite"))?;conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);")?;app.manage(Db(Mutex::new(conn)));
let show=MenuItem::with_id(app,"show","TecTracker öffnen",true,None::<&str>)?;let toggle=MenuItem::with_id(app,"toggle","Timer starten / stoppen",true,None::<&str>)?;let quit=MenuItem::with_id(app,"quit","Beenden",true,None::<&str>)?;let menu=Menu::with_items(app,&[&show,&toggle,&quit])?;
TrayIconBuilder::new().icon(tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))?).tooltip("TecTracker").menu(&menu).on_menu_event(|app,event|{match event.id.as_ref(){"quit"=>app.exit(0),"toggle"=>{let _=app.emit("timer-toggle",());},_=>{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}}}}).build(app)?;Ok(())}).on_window_event(|w,e|{if let tauri::WindowEvent::CloseRequested{api,..}=e{api.prevent_close();let _=w.hide();}}).invoke_handler(tauri::generate_handler![load_state,save_state,export_file,backup_state]).run(tauri::generate_context!()).expect("TecTracker konnte nicht gestartet werden");
}
