use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use anyhow::Result;

use crate::workspace::Workspace;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Brief {
    pub client_name: String,
    pub website: String,
    pub business_type: String,
    pub goal: String,
    pub target_customer: String,
    pub conversion_action: String,
}

#[derive(Debug, Clone)]
pub struct AgencyConfig {
    pub agency_name: String,
    pub auditor_name: String,
    pub audit_price: String,
    pub refresh_price: String,
    pub growth_price: String,
}

impl Default for AgencyConfig {
    fn default() -> Self {
        Self {
            agency_name: "Origin".to_string(),
            auditor_name: "Daniel White".to_string(),
            audit_price: "Starting at £299".to_string(),
            refresh_price: "Starting at £1,999".to_string(),
            growth_price: "Starting at £499/mo".to_string(),
        }
    }
}

pub fn parse_brief(markdown: &str) -> Brief {
    Brief {
        client_name: markdown
            .lines()
            .find_map(|line| {
                line.strip_prefix("# ")
                    .and_then(|line| line.strip_suffix(" Audit Brief"))
            })
            .unwrap_or("Client")
            .to_string(),
        website: field(markdown, "Website"),
        business_type: field(markdown, "Business type"),
        goal: field(markdown, "Goal"),
        target_customer: field(markdown, "Target customer"),
        conversion_action: field(markdown, "Main conversion action"),
    }
}

fn field(markdown: &str, label: &str) -> String {
    let prefix = format!("{label}:");
    markdown
        .lines()
        .find_map(|line| line.strip_prefix(&prefix))
        .map(str::trim)
        .unwrap_or("")
        .to_string()
}

fn strip_title(markdown: &str) -> String {
    markdown
        .lines()
        .skip_while(|line| line.starts_with("# "))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn heading_from_page_path(path: &str) -> String {
    let name = path
        .trim_start_matches("pages/")
        .trim_end_matches(".md")
        .replace("home", "homepage")
        .replace(['-', '_'], " ");

    name.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn build_final_report(
    config: &AgencyConfig,
    folder_name: &str,
    files: &BTreeMap<String, String>,
) -> String {
    let brief = parse_brief(files.get("brief.md").map(String::as_str).unwrap_or(""));
    let old_page_sections = files
        .iter()
        .filter(|(path, _)| path.starts_with("pages/") && path.ends_with(".md"))
        .map(|(path, content)| {
            format!(
                "### {} Review\n\n{}",
                heading_from_page_path(path),
                strip_title(content)
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    let page_sections = workspace_section(files, "Page Reviews", "")
        .filter(|content| !content.contains("No page reviews provided yet."))
        .unwrap_or(old_page_sections);

    format!(
        "# {} Website Audit\n\nPrepared by {}, {}\nAudit folder: {}\n\n## Context\n\nWebsite: {}\nGoal: {}\nBusiness type: {}\nTarget customer: {}\nMain conversion action: {}\n\n## Scorecard\n\n{}\n\n## Automated Check\n\n{}\n\n## Security Check\n\n{}\n\n## Lighthouse Check\n\n{}\n\n## Findings\n\n{}\n\n## Page Reviews\n\n{}\n\n## Recommended Next Step\n\nAudit: {}\nRefresh: {}\nGrowth: {}\n\nUse the audit to prioritise immediate fixes. If most findings require design, copy, and frontend changes, the Refresh package is likely the best next step.\n",
        brief.client_name,
        config.auditor_name,
        config.agency_name,
        folder_name,
        brief.website,
        brief.goal,
        empty_or(&brief.business_type, "Not specified"),
        empty_or(&brief.target_customer, "Not specified"),
        empty_or(&brief.conversion_action, "Not specified"),
        workspace_section(files, "Scorecard", "Not completed yet.")
            .unwrap_or_else(|| section_file(files, "scorecard.md", "Not completed yet.")),
        workspace_section(files, "Automated Check", "Not run yet.")
            .unwrap_or_else(|| section_file(files, "automated-check.md", "Not run yet.")),
        workspace_section(files, "Security Check", "Not run yet.")
            .unwrap_or_else(|| section_file(files, "security.md", "Not run yet.")),
        workspace_section(files, "Lighthouse Check", "Not run yet.")
            .unwrap_or_else(|| section_file(files, "lighthouse.md", "Not run yet.")),
        section_file(files, "findings.md", "No findings captured yet."),
        if page_sections.is_empty() { "No page reviews captured yet.".to_string() } else { page_sections },
        config.audit_price,
        config.refresh_price,
        config.growth_price,
    )
}

pub fn build_client_email(config: &AgencyConfig, brief: &Brief) -> String {
    format!(
        "Subject: Website audit for {}\n\nHi,\n\nI've completed the website audit for {}.\n\nThe report is in final-report.md. I also included a video-script.md outline so the walkthrough can focus on the highest-impact issues.\n\nMain goal reviewed: {}\n\nRecommended next step:\nReview the priority fixes in the report. If you want me to handle the design, copy, and implementation work, the Refresh package is the most likely fit.\n\nThanks,\n{}\n{}\n",
        brief.client_name,
        empty_or(&brief.website, "your website"),
        empty_or(&brief.goal, "Not specified"),
        config.auditor_name,
        config.agency_name
    )
}

pub fn generate_report(workspace: &Workspace, folder_name: &str) -> Result<(PathBuf, PathBuf)> {
    let config = load_config(workspace);
    let files = workspace.read_audit_files(folder_name)?;
    let brief = parse_brief(files.get("brief.md").map(String::as_str).unwrap_or(""));
    let report = build_final_report(&config, folder_name, &files);
    let email = build_client_email(&config, &brief);
    let report_path = workspace.write_audit_file(folder_name, "final-report.md", &report)?;
    let email_path = workspace.write_audit_file(folder_name, "client-email.md", &email)?;
    Ok((report_path, email_path))
}

fn section_file(files: &BTreeMap<String, String>, path: &str, fallback: &str) -> String {
    files
        .get(path)
        .map(|content| strip_title(content))
        .filter(|content| !content.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn workspace_section(
    files: &BTreeMap<String, String>,
    heading: &str,
    fallback: &str,
) -> Option<String> {
    let workspace = files.get("workspace.md")?;
    let heading = format!("## {heading}");
    let lines = workspace.lines().collect::<Vec<_>>();
    let start = lines.iter().position(|line| line.trim() == heading)? + 1;
    let end = lines
        .iter()
        .enumerate()
        .skip(start)
        .find_map(|(index, line)| line.starts_with("## ").then_some(index))
        .unwrap_or(lines.len());
    let content = lines[start..end].join("\n").trim().to_string();
    if content.is_empty() {
        Some(fallback.to_string())
    } else {
        Some(content)
    }
}

fn empty_or<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    if value.trim().is_empty() {
        fallback
    } else {
        value
    }
}

fn load_config(workspace: &Workspace) -> AgencyConfig {
    let path = workspace.root.join("auditkit.config.json");
    let Ok(content) = fs::read_to_string(path) else {
        return AgencyConfig::default();
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
        return AgencyConfig::default();
    };

    let mut config = AgencyConfig::default();
    config.agency_name = json["agencyName"]
        .as_str()
        .unwrap_or(&config.agency_name)
        .to_string();
    config.auditor_name = json["auditorName"]
        .as_str()
        .unwrap_or(&config.auditor_name)
        .to_string();
    config.audit_price = json["services"]["audit"]
        .as_str()
        .unwrap_or(&config.audit_price)
        .to_string();
    config.refresh_price = json["services"]["refresh"]
        .as_str()
        .unwrap_or(&config.refresh_price)
        .to_string();
    config.growth_price = json["services"]["growth"]
        .as_str()
        .unwrap_or(&config.growth_price)
        .to_string();
    config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_brief_extracts_context() {
        let brief = parse_brief(
            "# Acme Dental Audit Brief\n\nWebsite: https://example.com\nGoal: More bookings",
        );
        assert_eq!(brief.client_name, "Acme Dental");
        assert_eq!(brief.website, "https://example.com");
        assert_eq!(brief.goal, "More bookings");
    }

    #[test]
    fn final_report_includes_security_and_lighthouse() {
        let mut files = BTreeMap::new();
        files.insert(
            "brief.md".to_string(),
            "# Acme Dental Audit Brief\n\nWebsite: https://example.com\nGoal: Leads".to_string(),
        );
        files.insert(
            "security.md".to_string(),
            "# Security Check\n\nScore: 50/100".to_string(),
        );
        files.insert(
            "lighthouse.md".to_string(),
            "# Lighthouse Check\n\nPerformance: 100/100".to_string(),
        );
        files.insert(
            "pages/home.md".to_string(),
            "# Homepage Review\n\n## CTA".to_string(),
        );

        let report = build_final_report(&AgencyConfig::default(), "2026-acme", &files);
        assert!(report.contains("## Security Check"));
        assert!(report.contains("Score: 50/100"));
        assert!(report.contains("## Lighthouse Check"));
        assert!(report.contains("### Homepage Review"));
    }

    #[test]
    fn final_report_reads_consolidated_workspace_sections() {
        let mut files = BTreeMap::new();
        files.insert(
            "brief.md".to_string(),
            "# Acme Dental Audit Brief\n\nWebsite: https://example.com\nGoal: Leads".to_string(),
        );
        files.insert(
            "workspace.md".to_string(),
            "# Audit Workspace\n\n## Scorecard\n\nPerformance: 8/10\n\n## Automated Check\n\nScore: 74/100\n\n## Security Check\n\nScore: 50/100\n\n## Lighthouse Check\n\nPerformance: 87/100\n\n## Page Reviews\n\n### Homepage Review\n\nCTA needs work.\n".to_string(),
        );
        files.insert(
            "findings.md".to_string(),
            "# Findings\n\n## Critical".to_string(),
        );

        let report = build_final_report(&AgencyConfig::default(), "2026-acme", &files);
        assert!(report.contains("Performance: 8/10"));
        assert!(report.contains("Score: 74/100"));
        assert!(report.contains("Performance: 87/100"));
        assert!(report.contains("CTA needs work."));
    }
}
