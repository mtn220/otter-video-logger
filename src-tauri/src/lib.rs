use tauri::{Emitter, Manager};

// Raw Win32 bindings — all three functions live in user32.dll, which Tauri already links.
#[cfg(target_os = "windows")]
mod win32 {
    pub type HMONITOR = *mut std::ffi::c_void;

    #[repr(C)]
    pub struct POINT { pub x: i32, pub y: i32 }

    #[repr(C)]
    #[derive(Default)]
    pub struct RECT { pub left: i32, pub top: i32, pub right: i32, pub bottom: i32 }

    #[repr(C)]
    pub struct MONITORINFO {
        pub cb_size:    u32,
        pub rc_monitor: RECT,
        pub rc_work:    RECT,
        pub dw_flags:   u32,
    }

    pub const MONITOR_DEFAULTTONEAREST: u32 = 2;
    // System-metric indices used for title-bar height detection.
    pub const SM_CYCAPTION:      i32 = 4;   // caption / title-bar height
    pub const SM_CYFRAME:        i32 = 33;  // sizing-border height
    pub const SM_CXPADDEDBORDER: i32 = 92;  // DWM padding added to frame

    #[link(name = "user32")]
    extern "system" {
        pub fn MonitorFromPoint(pt: POINT, flags: u32) -> HMONITOR;
        pub fn GetMonitorInfoW(monitor: HMONITOR, info: *mut MONITORINFO) -> i32;
        pub fn GetSystemMetricsForDpi(index: i32, dpi: u32) -> i32;
    }
}

/// Returns (work_width, work_height, title_bar_height, work_x, work_y) in physical pixels.
///
/// work_height excludes the taskbar. Subtracting title_bar_height from it gives the
/// inner_size height that makes the window's outer dimensions exactly fill the work area.
#[cfg(target_os = "windows")]
fn windows_work_area(mon_x: i32, mon_y: i32, scale_factor: f64) -> Option<(u32, u32, u32, i32, i32)> {
    use win32::*;
    unsafe {
        let hmon = MonitorFromPoint(POINT { x: mon_x, y: mon_y }, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cb_size:    std::mem::size_of::<MONITORINFO>() as u32,
            rc_monitor: RECT::default(),
            rc_work:    RECT::default(),
            dw_flags:   0,
        };
        if GetMonitorInfoW(hmon, &mut info) == 0 {
            return None;
        }
        let work_w = (info.rc_work.right  - info.rc_work.left) as u32;
        let work_h = (info.rc_work.bottom - info.rc_work.top)  as u32;
        let work_x = info.rc_work.left;
        let work_y = info.rc_work.top;

        // GetSystemMetricsForDpi returns physical pixel values at the given DPI.
        let dpi = (scale_factor * 96.0).round() as u32;
        let caption = GetSystemMetricsForDpi(SM_CYCAPTION, dpi);
        let frame   = GetSystemMetricsForDpi(SM_CYFRAME, dpi);
        let padding = GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
        let title_bar = (caption + frame + padding).max(0) as u32;

        Some((work_w, work_h, title_bar, work_x, work_y))
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoInfo {
    name: String,
    modified_ms: i64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoFolderResult {
    folder_path: String,
    videos: Vec<VideoInfo>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RenameResult {
    old_name: String,
    new_name: String,
}

#[tauri::command]
async fn open_video_folder(app: tauri::AppHandle) -> Result<Option<VideoFolderResult>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |f| {
        let _ = tx.send(f);
    });
    let folder = rx.await.map_err(|e| e.to_string())?;
    let Some(folder_path) = folder else {
        return Ok(None);
    };
    let folder_path_str = folder_path.to_string();

    let video_extensions = ["mp4", "webm", "ogg", "ogv"];
    let mut videos: Vec<VideoInfo> = vec![];

    for entry in std::fs::read_dir(&folder_path_str).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
        if video_extensions.contains(&ext.as_str()) {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let modified_ms = metadata
                .modified()
                .map_err(|e| e.to_string())?
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            videos.push(VideoInfo { name, modified_ms });
        }
    }

    videos.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(Some(VideoFolderResult {
        folder_path: folder_path_str,
        videos,
    }))
}

#[tauri::command]
async fn change_video(
    app: tauri::AppHandle,
    folder_path: String,
    file_name: String,
) -> Result<(), String> {
    let video_path = std::path::Path::new(&folder_path).join(&file_name);
    let video_path_str = video_path.to_string_lossy().to_string();

    if let Some(win) = app.get_webview_window("video") {
        win.emit("change-video", serde_json::json!({ "videoPath": video_path_str }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn rename_file(
    app: tauri::AppHandle,
    old_name: String,
    new_text: String,
    rename_type: String,
    folder_path: String,
) -> Result<RenameResult, String> {
    let ext = std::path::Path::new(&old_name)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let stem = std::path::Path::new(&old_name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let new_name = match rename_type.as_str() {
        "prepend" => format!("{}_{}", new_text, old_name),
        "replace" => new_text.clone(),
        _ => format!("{}_{}{}", stem, new_text, ext),
    };

    if let Some(win) = app.get_webview_window("video") {
        let _ = win.emit("clear-video-src", ());
    }

    let old_path = std::path::Path::new(&folder_path).join(&old_name);
    let new_path = std::path::Path::new(&folder_path).join(&new_name);

    for attempt in 0..10 {
        match std::fs::rename(&old_path, &new_path) {
            Ok(()) => return Ok(RenameResult { old_name, new_name }),
            Err(e)
                if attempt < 9
                    && (e.kind() == std::io::ErrorKind::PermissionDenied
                        || e.raw_os_error() == Some(32)) =>
            {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("Reached max retries. Resource busy.".to_string())
}

#[tauri::command]
async fn data_to_clipboard(text: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        arboard::Clipboard::new()
            .and_then(|mut c| c.set_text(text))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

#[tauri::command]
fn get_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "darwin"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "linux"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let (tools_width, video_width, win_height, video_x, tools_x, win_y) =
                match app.primary_monitor() {
                    Ok(Some(monitor)) => {
                        let scale = monitor.scale_factor();
                        let phys = monitor.size();
                        let mon_pos = monitor.position();

                        // On Windows, use the work area (excludes taskbar) and subtract
                        // the title bar height so the outer window fills the work area
                        // exactly. On other platforms use the full monitor size.
                        #[cfg(target_os = "windows")]
                        let (phys_w, phys_h, title_bar_h, work_x, work_y) =
                            windows_work_area(mon_pos.x, mon_pos.y, scale)
                                .unwrap_or((phys.width, phys.height, 0, mon_pos.x, mon_pos.y));
                        #[cfg(not(target_os = "windows"))]
                        let (phys_w, phys_h, title_bar_h, work_x, work_y) =
                            (phys.width, phys.height, 0u32, mon_pos.x, mon_pos.y);

                        let lw = phys_w as f64 / scale;
                        let lh = phys_h.saturating_sub(title_bar_h) as f64 / scale;
                        let mx = work_x as f64 / scale;
                        let my = work_y as f64 / scale;
                        let tw = if lw > 1576.0 { 580.0_f64 } else { 360.0_f64 };
                        (tw, lw - tw, lh, mx, mx + lw - tw, my)
                    }
                    _ => (580.0, 1000.0, 800.0, 0.0, 1000.0, 0.0),
                };

            let tools_win = tauri::WebviewWindowBuilder::new(
                app,
                "tools",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Otter Logger")
            .inner_size(tools_width, win_height)
            .build()?;

            let video_win = tauri::WebviewWindowBuilder::new(
                app,
                "video",
                tauri::WebviewUrl::App("video.html".into()),
            )
            .title("Otter Logger - Video")
            .inner_size(video_width, win_height)
            .build()?;

            let _ = video_win.set_position(tauri::LogicalPosition::new(video_x, win_y));
            let _ = tools_win.set_position(tauri::LogicalPosition::new(tools_x, win_y));

            let ah = app.handle().clone();
            tools_win.on_window_event(move |event| {
                if matches!(event, tauri::WindowEvent::Destroyed) {
                    if let Some(w) = ah.get_webview_window("video") {
                        let _ = w.close();
                    }
                }
            });

            let ah = app.handle().clone();
            video_win.on_window_event(move |event| {
                if matches!(event, tauri::WindowEvent::Destroyed) {
                    if let Some(w) = ah.get_webview_window("tools") {
                        let _ = w.close();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_video_folder,
            change_video,
            rename_file,
            data_to_clipboard,
            get_platform,
            open_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
