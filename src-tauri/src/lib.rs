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
use std::path::{Path, PathBuf};

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

/// 批量导出用的单个文件：名字 + 可选子目录 + 内容
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutFile {
    name: String,
    sub_dir: Option<String>,
    contents: Vec<u8>,
}

/// 拼出安全的输出路径：文件名由前端给（已清洗过），这里再防一手路径穿越，
/// 保证只会写在用户选定的目录里面。
fn safe_join(root: &Path, sub_dir: Option<&str>, name: &str) -> Result<PathBuf, String> {
    let illegal = |s: &str| s.contains("..") || s.contains('/') || s.contains('\\') || s.contains(':');
    if name.is_empty() || illegal(name) {
        return Err(format!("文件名不合法：{name}"));
    }
    let mut path = root.to_path_buf();
    if let Some(sub) = sub_dir {
        if !sub.is_empty() {
            if illegal(sub) {
                return Err(format!("子目录名不合法：{sub}"));
            }
            path.push(sub);
        }
    }
    path.push(name);
    Ok(path)
}

/// 批量写盘：一次导出会产生多个文件，选一次目录全部写进去。
/// 与 save_file 一样，内容以字节数组传输，前端不需要任何文件系统权限。
#[tauri::command]
fn save_files(dir: String, files: Vec<OutFile>) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&dir);
    if !root.is_dir() {
        return Err(format!("导出目录不存在：{dir}"));
    }
    let mut written: Vec<String> = Vec::new();
    for file in files {
        let target = safe_join(&root, file.sub_dir.as_deref(), &file.name)?;
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("无法创建目录 {}：{e}", parent.display()))?;
        }
        std::fs::write(&target, file.contents).map_err(|e| format!("写入失败 {}：{e}", target.display()))?;
        written.push(target.to_string_lossy().to_string());
    }
    Ok(written)
}

/// 打印当前窗口：PDF 导出走这条路（用户在打印对话框里「另存为 PDF」并挑保存位置）。
/// Windows 下 wry 的实现就是执行 window.print()，macOS / Linux 走各自的原生打印。
///
/// 必须按平台分开写：Tauri 的 `WebviewWindow::print()` 在 `#[cfg(desktop)]` 的 impl 块里，
/// 移动端**没有**这个方法 —— 直接在 Android 上编译会报 E0599。
#[cfg(desktop)]
#[tauri::command]
fn print_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口".to_string())?;
    window.print().map_err(|e| format!("打印失败：{e}"))
}

/// 移动端的同名命令：Tauri 文档说明 `window.print()` 在所有平台可用，
/// 所以前端在移动端会直接调页面的 window.print()，正常不会走到这里；
/// 万一走到了就如实报错，别让调用方以为打印成功了。
#[cfg(mobile)]
#[tauri::command]
fn print_window(_app: tauri::AppHandle) -> Result<(), String> {
    Err("移动端请使用系统打印（window.print），此接口仅桌面端可用".into())
}

/// 应用入口
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![app_info, save_file, save_files, print_window])
        .setup(|_app| {
            // 数据层完全在前端 IndexedDB 中，这里不需要额外初始化。
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 WorldForge 失败");
}
