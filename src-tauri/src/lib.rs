//! WorldForge Tauri 壳
//!
//! 设计原则：**前端自给自足**。
//! 数据全部存在 WebView 的 IndexedDB（SQLite WASM 快照）里，
//! Rust 侧只提供「平台信息」这类无法在前端可靠获取的能力，
//! 因此前端代码在浏览器（PWA）与桌面/移动壳里完全一致，不需要分叉。
use serde::Serialize;

/// 平台信息：供「设置 → 关于」展示
#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub tauri_version: String,
    pub platform: String,
    pub arch: String,
}

/// 返回运行环境信息
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "WorldForge".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        tauri_version: tauri::VERSION.into(),
        platform: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
    }
}

/// 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .setup(|_app| {
            // v0.1 不需要额外初始化；数据层完全在前端 IndexedDB 中。
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 WorldForge 失败");
}
