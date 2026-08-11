//! Tauri's build step: it reads `tauri.conf.json` and generates the context the
//! `generate_context!` macro in `main.rs` expands to.
fn main() {
    tauri_build::build();
}
