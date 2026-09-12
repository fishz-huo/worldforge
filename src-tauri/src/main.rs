// Windows 发行版不弹出控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 桌面端入口：实际逻辑在 lib.rs，便于移动端复用
fn main() {
    worldforge_lib::run()
}
