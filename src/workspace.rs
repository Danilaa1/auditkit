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

    pub fn update_workspace_section(
        &self,
        folder_name: &str,
        heading: &str,
        content: &str,
    ) -> Result<PathBuf> {
        let path = self.audit_folder(folder_name).join("workspace.md");
        let existing =
            fs::read_to_string(&path).unwrap_or_else(|_| "# Audit Workspace\n".to_string());
        let updated = replace_markdown_section(&existing, heading, content);
        fs::write(&path, updated)?;
        Ok(path)
    }
}

fn replace_markdown_section(document: &str, heading: &str, content: &str) -> String {
    let heading = format!("## {heading}");
    let content = normalise_section_content(content);
    let lines = document.lines().collect::<Vec<_>>();
    let Some(start) = lines.iter().position(|line| line.trim() == heading) else {
        return format!("{}\n\n{}\n\n{}\n", document.trim_end(), heading, content);
    };
    let end = lines
        .iter()
        .enumerate()
        .skip(start + 1)
        .find_map(|(index, line)| line.starts_with("## ").then_some(index))
        .unwrap_or(lines.len());

    let mut output = Vec::new();
    output.extend_from_slice(&lines[..=start]);
    output.push("");
    output.extend(content.lines());
    output.push("");
    output.extend_from_slice(&lines[end..]);
    format!("{}\n", output.join("\n").trim_end())
}

fn normalise_section_content(content: &str) -> String {
    let content = content.trim();
    if content.starts_with("# ") {
        return content
            .lines()
            .skip(1)
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string();
    }
    content.to_string()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_existing_workspace_section() {
        let document = "# Audit Workspace\n\n## Automated Check\n\nNot run yet.\n\n## Security Check\n\nNot run yet.\n";
        let updated = replace_markdown_section(
            document,
            "Automated Check",
            "# Automated Check\n\nScore: 90/100",
        );
        assert!(updated.contains("## Automated Check\n\nScore: 90/100\n\n## Security Check"));
        assert!(!updated.contains("Not run yet.\n\n## Security Check"));
    }

    #[test]
    fn appends_missing_workspace_section() {
        let document = "# Audit Workspace\n";
        let updated = replace_markdown_section(document, "Lighthouse Check", "Performance: 80/100");
        assert!(updated.contains("## Lighthouse Check\n\nPerformance: 80/100"));
    }
}
