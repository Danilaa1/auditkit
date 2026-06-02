use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LighthousePaths {
    pub markdown_path: PathBuf,
    pub json_path: PathBuf,
}

pub fn run_lighthouse(
    root: &Path,
    url: &str,
    output_folder: Option<&Path>,
) -> Result<LighthousePaths> {
    let script = root.join("scripts/lighthouse.mjs");
    let mut command = Command::new("node");
    command.arg(script).arg(url);

    if let Some(folder) = output_folder {
        command.arg("--out").arg(folder);
    }

    let output = command.output().context("Running Node Lighthouse helper")?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("{}", stderr.trim());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let markdown_path = find_output_path(&stdout, "LIGHTHOUSE_MD:")
        .map(PathBuf::from)
        .unwrap_or_else(|| output_folder.unwrap_or(root).join("lighthouse.md"));
    let json_path = find_output_path(&stdout, "LIGHTHOUSE_JSON:")
        .map(PathBuf::from)
        .unwrap_or_else(|| output_folder.unwrap_or(root).join("lighthouse.json"));

    for line in stdout.lines() {
        if !line.contains("LIGHTHOUSE_MD:") && !line.contains("LIGHTHOUSE_JSON:") {
            println!("{line}");
        }
    }
    Ok(LighthousePaths {
        markdown_path,
        json_path,
    })
}

fn find_output_path(stdout: &str, prefix: &str) -> Option<String> {
    stdout
        .lines()
        .find_map(|line| line.strip_prefix(prefix))
        .map(str::trim)
        .map(ToOwned::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_helper_output_paths() {
        let stdout =
            "ok\nLIGHTHOUSE_MD: /tmp/lighthouse.md\nLIGHTHOUSE_JSON: /tmp/lighthouse.json\n";
        assert_eq!(
            find_output_path(stdout, "LIGHTHOUSE_MD:"),
            Some("/tmp/lighthouse.md".to_string())
        );
    }
}
