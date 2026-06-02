//! Audit Kit library modules.
//!
//! The binary in `main.rs` wires these modules together. Each module owns one
//! small part of the workflow, so a Rust beginner can read one file at a time.

/// Shared audit input helpers such as slug creation and comma-list parsing.
pub mod audit;
/// Lightweight HTML checks: title, meta description, H1, images, CTA signals.
pub mod html_check;
/// Bridge from Rust to the Node Lighthouse helper.
pub mod lighthouse;
/// Final report and client email generation.
pub mod report;
/// Security header checks.
pub mod security;
/// Markdown templates used when creating a new audit workspace.
pub mod templates;
/// Terminal output helpers.
pub mod ui;
/// File paths, audit folder lookup, and read/write helpers.
pub mod workspace;
