//! WorldForge Tauri 壳
//!
//! 设计原则：**前端自给自足**。
//! 数据全部存在 WebView 的 IndexedDB（SQLite WASM 快照）里，
//! Rust 侧只提供「平台信息」与「写文件」这两件前端做不可靠的事，
//! 因此前端代码在浏览器（PWA）与桌面/移动壳里基本一致。
//!
//! 为什么要「写文件」命令：网页版导出只能交给浏览器下载（位置不可选）；
//! 桌面版用系统「另存为」对话框拿到路径后，由 Rust 直接写盘 ——
//! 这样前端不需要申请文件系统权限（capabilities 里只放开 dialog）。
use serde::Serialize;
use std::path::PathBuf;

/// 平台信息：供「设置 → 关于」展示
#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub tauri_version: String,
    pub platform: String,
    pub arch: String,
    /// 数据目录：WebView2 的应用数据目录，告诉用户数据到底存在哪
    pub data_dir: String,
}

/// 返回运行环境信息
#[tauri::command]
fn app_info(app: tauri::AppHandle) -> AppInfo {
    use tauri::Manager;
    let data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "（未知）".into());
    AppInfo {
        name: "WorldForge".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        tauri_version: tauri::VERSION.into(),
        platform: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        data_dir,
    }
}

/// 把内容写入用户选择的路径（导出备份用）。
/// 内容以字节数组传入：大文件不必先变成 JSON 字符串，省内存也省时间。
#[tauri::command]
fn save_file(path: String, contents: Vec<u8>) -> Result<String, String> {
    let target = PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("无法创建目录 {}：{e}", parent.display()))?;
        }
    }
    std::fs::write(&target, contents).map_err(|e| format!("写入失败 {}：{e}", target.display()))?;
    Ok(target.to_string_lossy().to_string())
}

/// 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![app_info, save_file])
        .setup(|_app| {
            // 数据层完全在前端 IndexedDB 中，这里不需要额外初始化。
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 WorldForge 失败");
}
