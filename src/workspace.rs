use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::audit::AuditInput;
use crate::templates;

#[derive(Debug, Clone)]
pub struct Workspace {
    pub root: PathBuf,
    pub audits_dir: PathBuf,
}

impl Workspace {
    pub fn discover() -> Result<Self> {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        Ok(Self {
            audits_dir: manifest_dir.join("audits"),
            root: manifest_dir,
        })
    }

    pub fn audit_folder(&self, folder_name: &str) -> PathBuf {
        self.audits_dir.join(folder_name)
    }

    pub fn create_audit(&self, audit: &AuditInput) -> Result<PathBuf> {
        let folder = self.audit_folder(&format!("{}-{}", audit.created_at, audit.slug));
        fs::create_dir_all(&folder)?;

        for (relative, content) in templates::create_audit_files(audit) {
            let path = folder.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(path, content)?;
        }

        Ok(folder)
    }

    pub fn list_audits(&self) -> Result<Vec<String>> {
        fs::create_dir_all(&self.audits_dir)?;
        let mut folders = Vec::new();

        for entry in fs::read_dir(&self.audits_dir)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                folders.push(entry.file_name().to_string_lossy().to_string());
            }
        }

        folders.sort();
        Ok(folders)
    }

    pub fn resolve_target(&self, target: Option<&str>) -> Result<String> {
        let folders = self.list_audits()?;
        if folders.is_empty() {
            anyhow::bail!("No audits found.");
        }

        match target {
            None | Some("latest") => Ok(folders.last().expect("non-empty").to_string()),
            Some(value) if folders.iter().any(|folder| folder == value) => Ok(value.to_string()),
            Some(value) => anyhow::bail!("Audit folder not found: {value}"),
        }
    }

    pub fn read_audit_files(&self, folder_name: &str) -> Result<BTreeMap<String, String>> {
        let folder = self.audit_folder(folder_name);
        let mut files = BTreeMap::new();
        read_markdown_files(&folder, &folder, &mut files)?;
        Ok(files)
    }

    pub fn write_audit_file(
        &self,
        folder_name: &str,
        filename: &str,
        content: &str,
    ) -> Result<PathBuf> {
        let path = self.audit_folder(folder_name).join(filename);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&path, content)?;
        Ok(path)
    }
}

fn read_markdown_files(
    root: &Path,
    current: &Path,
    files: &mut BTreeMap<String, String>,
) -> Result<()> {
    for entry in fs::read_dir(current).with_context(|| format!("Reading {}", current.display()))? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            read_markdown_files(root, &path, files)?;
        } else if path.extension().is_some_and(|extension| extension == "md") {
            let relative = path.strip_prefix(root)?.to_string_lossy().to_string();
            files.insert(relative, fs::read_to_string(path)?);
        }
    }

    Ok(())
}
