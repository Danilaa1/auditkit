use std::{
    env, fs,
    path::{Path, PathBuf},
    process,
};

use anyhow::{Context, Result};
use auditkit::audit::{slugify, split_comma_list, AuditInput};
use auditkit::html_check;
use auditkit::lighthouse;
use auditkit::report;
use auditkit::security;
use auditkit::ui;
use auditkit::workspace::Workspace;
use chrono::Local;
use clap::{Parser, Subcommand};
use url::Url;

#[derive(Parser)]
#[command(name = "ak", about = "Audit Kit: small agency website audit workflow")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    New,
    List,
    Check {
        target: Option<String>,
        #[arg(long, value_name = "FOLDER", num_args = 0..=1)]
        save: Option<Option<String>>,
    },
    Security {
        target: Option<String>,
        #[arg(long, value_name = "FOLDER", num_args = 0..=1)]
        save: Option<Option<String>>,
    },
    Lighthouse {
        target: Option<String>,
        #[arg(long, value_name = "FOLDER", num_args = 0..=1)]
        save: Option<Option<String>>,
    },
    Inspect {
        target: Option<String>,
        #[arg(long, value_name = "FOLDER", num_args = 0..=1)]
        save: Option<Option<String>>,
    },
    Report {
        target: Option<String>,
    },
}

#[derive(Debug, Clone, Copy)]
struct SaveRequest<'a> {
    explicit: bool,
    value: Option<&'a str>,
}

#[derive(Debug, Clone)]
enum SaveDestination {
    Audit(String),
    Directory(PathBuf),
}

#[derive(Debug, Clone)]
struct TargetInput {
    value: String,
    prompted: bool,
}

fn main() {
    if let Err(error) = run() {
        ui::error(error);
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();
    let workspace = Workspace::discover()?;

    match cli.command {
        Some(Command::New) => new_audit(&workspace),
        Some(Command::List) => list_audits(&workspace),
        Some(Command::Check { target, save }) => {
            check(&workspace, target.as_deref(), save_request(&save))
        }
        Some(Command::Security { target, save }) => {
            security_check(&workspace, target.as_deref(), save_request(&save))
        }
        Some(Command::Lighthouse { target, save }) => {
            lighthouse_check(&workspace, target.as_deref(), save_request(&save))
        }
        Some(Command::Inspect { target, save }) => {
            inspect(&workspace, target.as_deref(), save_request(&save))
        }
        Some(Command::Report { target }) => generate_report(&workspace, target.as_deref()),
        None => {
            ui::help();
            Ok(())
        }
    }
}

fn save_request(value: &Option<Option<String>>) -> SaveRequest<'_> {
    match value {
        None => SaveRequest {
            explicit: false,
            value: None,
        },
        Some(None) => SaveRequest {
            explicit: true,
            value: None,
        },
        Some(Some(value)) => SaveRequest {
            explicit: true,
            value: Some(value),
        },
    }
}

fn new_audit(workspace: &Workspace) -> Result<()> {
    let answers = ui::collect_audit_input()?;

    let audit = AuditInput {
        slug: slugify(&answers.client_name),
        client_name: answers.client_name,
        url: answers.url,
        business_type: answers.business_type,
        goal: answers.goal,
        target_customer: answers.target_customer,
        conversion_action: answers.conversion_action,
        pages: split_comma_list(&answers.pages),
        known_concerns: split_comma_list(&answers.known_concerns),
        competitors: split_comma_list(&answers.competitors),
        created_at: Local::now().format("%Y-%m-%d").to_string(),
    };

    let folder = workspace.create_audit(&audit)?;
    ui::section("Audit Created");
    ui::saved(folder.display());
    ui::bullet("Next: ak inspect latest");
    ui::bullet("Then fill workspace.md and findings.md");
    Ok(())
}

fn list_audits(workspace: &Workspace) -> Result<()> {
    ui::section("Audits");
    let folders = workspace.list_audits()?;
    if folders.is_empty() {
        println!("No audits yet.");
    } else {
        for folder in folders {
            ui::bullet(&folder);
        }
    }
    Ok(())
}

fn check(workspace: &Workspace, target: Option<&str>, save: SaveRequest<'_>) -> Result<()> {
    let target = target_or_prompt("Website URL", "https://example.com", target)?;
    ui::section("Website Check");
    ui::step(1, "Website", &target.value);

    if looks_like_url(&target.value) {
        let result = ui::with_task("Fetching website and reading HTML", || {
            html_check::check_url(&target.value)
        })?;
        println!("{}", html_check::format_cli(&result));
        if let Some(destination) = save_destination_for_result(
            workspace,
            save,
            &target.value,
            "Save this check as markdown?",
            target.prompted,
        )? {
            save_html_result(workspace, &destination, &result)?;
        }
        return Ok(());
    }

    let folder = workspace.resolve_target(Some(&target.value))?;
    let website = audit_website(workspace, &folder)?;
    let result = ui::with_task("Fetching website and reading HTML", || {
        html_check::check_url(&website)
    })?;
    println!("{}", html_check::format_cli(&result));
    let destination = if save.explicit {
        resolve_save_destination(workspace, save.value, &website)?
    } else {
        SaveDestination::Audit(folder)
    };
    save_html_result(workspace, &destination, &result)?;
    Ok(())
}

fn security_check(
    workspace: &Workspace,
    target: Option<&str>,
    save: SaveRequest<'_>,
) -> Result<()> {
    let target = target.unwrap_or("latest");
    ui::section("Security Check");
    ui::step(1, "Target", target);

    if looks_like_url(target) {
        let result = ui::with_task("Checking security headers", || security::check_url(target))?;
        println!("{}", security::format_cli(&result));
        if let Some(destination) = save_destination_for_result(
            workspace,
            save,
            target,
            "Save this security check as markdown?",
            false,
        )? {
            save_security_result(workspace, &destination, &result)?;
        }
        return Ok(());
    }

    let folder = workspace.resolve_target(Some(target))?;
    let website = audit_website(workspace, &folder)?;
    let result = ui::with_task("Checking security headers", || {
        security::check_url(&website)
    })?;
    println!("{}", security::format_cli(&result));
    let destination = if save.explicit {
        resolve_save_destination(workspace, save.value, &website)?
    } else {
        SaveDestination::Audit(folder)
    };
    save_security_result(workspace, &destination, &result)?;
    Ok(())
}

fn lighthouse_check(
    workspace: &Workspace,
    target: Option<&str>,
    save: SaveRequest<'_>,
) -> Result<()> {
    let target = target.unwrap_or("latest");
    ui::section("Lighthouse Check");
    ui::step(1, "Target", target);

    if looks_like_url(target) {
        let destination = save_destination_for_result(
            workspace,
            save,
            target,
            "Save this Lighthouse report?",
            false,
        )?;
        run_lighthouse_for_url(workspace, target, destination.as_ref())?;
        return Ok(());
    }

    let folder = workspace.resolve_target(Some(target))?;
    let website = audit_website(workspace, &folder)?;
    let destination = if save.explicit {
        resolve_save_destination(workspace, save.value, &website)?
    } else {
        SaveDestination::Audit(folder)
    };
    run_lighthouse_for_url(workspace, &website, Some(&destination))?;
    Ok(())
}

fn inspect(workspace: &Workspace, target: Option<&str>, save: SaveRequest<'_>) -> Result<()> {
    let target = target.unwrap_or("latest");
    ui::section("Inspect");
    ui::step(1, "Target", target);

    if looks_like_url(target) {
        let destination =
            save_destination_for_result(workspace, save, target, "Save all audit files?", true)?;
        inspect_url(workspace, target, destination.as_ref())?;
        return Ok(());
    }

    let folder = workspace.resolve_target(Some(target))?;
    let website = audit_website(workspace, &folder)?;
    if save.explicit {
        let destination = resolve_save_destination(workspace, save.value, &website)?;
        inspect_url(workspace, &website, Some(&destination))?;
    } else {
        ui::bullet(&format!("Running checks for {folder}"));
        check(workspace, Some(&folder), SaveRequest::none())?;
        security_check(workspace, Some(&folder), SaveRequest::none())?;
        lighthouse_check(workspace, Some(&folder), SaveRequest::none())?;
    }
    Ok(())
}

fn inspect_url(
    workspace: &Workspace,
    target: &str,
    destination: Option<&SaveDestination>,
) -> Result<()> {
    ui::step(2, "HTML", "title, meta, H1, images, CTA signals");
    let html = ui::with_task("Fetching website and reading HTML", || {
        html_check::check_url(target)
    })?;
    println!("{}", html_check::format_cli(&html));
    if let Some(destination) = destination {
        save_html_result(workspace, destination, &html)?;
    }

    ui::step(3, "Security", "headers and browser protections");
    let security = ui::with_task("Checking security headers", || security::check_url(target))?;
    println!("{}", security::format_cli(&security));
    if let Some(destination) = destination {
        save_security_result(workspace, destination, &security)?;
    }

    ui::step(4, "Lighthouse", "performance, accessibility, SEO");
    run_lighthouse_for_url(workspace, target, destination)?;
    Ok(())
}

impl<'a> SaveRequest<'a> {
    fn none() -> Self {
        Self {
            explicit: false,
            value: None,
        }
    }
}

fn save_destination_for_result(
    workspace: &Workspace,
    save: SaveRequest<'_>,
    target: &str,
    prompt_label: &str,
    offer_prompt: bool,
) -> Result<Option<SaveDestination>> {
    if save.explicit {
        return resolve_save_destination(workspace, save.value, target).map(Some);
    }

    if offer_prompt && ui::can_prompt() && ui::confirm(prompt_label, true)? {
        return resolve_save_destination(workspace, None, target).map(Some);
    }

    Ok(None)
}

fn resolve_save_destination(
    workspace: &Workspace,
    value: Option<&str>,
    target: &str,
) -> Result<SaveDestination> {
    let raw = match value {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ if ui::can_prompt() => {
            ui::prompt_with_default("Save folder", &suggested_save_folder(target))?
        }
        _ => anyhow::bail!("Missing save folder. Use `--save <folder>`."),
    };

    let folders = workspace.list_audits()?;
    if raw == "latest" {
        let folder = folders
            .last()
            .with_context(|| "No audits found. Use a folder path such as `--save ./audit`.")?;
        return Ok(SaveDestination::Audit(folder.to_string()));
    }
    if folders.iter().any(|folder| folder == &raw) {
        return Ok(SaveDestination::Audit(raw));
    }

    Ok(SaveDestination::Directory(expand_path(&raw)?))
}

fn save_html_result(
    workspace: &Workspace,
    destination: &SaveDestination,
    result: &html_check::HtmlCheck,
) -> Result<()> {
    let markdown = html_check::format_markdown(result);
    match destination {
        SaveDestination::Audit(folder) => {
            let path = workspace.update_workspace_section(folder, "Automated Check", &markdown)?;
            ui::saved(path.display());
        }
        SaveDestination::Directory(folder) => {
            let path = write_save_file(folder, "automated-check.md", &markdown)?;
            ui::saved(path.display());
        }
    }
    Ok(())
}

fn save_security_result(
    workspace: &Workspace,
    destination: &SaveDestination,
    result: &security::SecurityCheck,
) -> Result<()> {
    let markdown = security::format_markdown(result);
    match destination {
        SaveDestination::Audit(folder) => {
            let path = workspace.update_workspace_section(folder, "Security Check", &markdown)?;
            ui::saved(path.display());
        }
        SaveDestination::Directory(folder) => {
            let path = write_save_file(folder, "security-check.md", &markdown)?;
            ui::saved(path.display());
        }
    }
    Ok(())
}

fn run_lighthouse_for_url(
    workspace: &Workspace,
    target: &str,
    destination: Option<&SaveDestination>,
) -> Result<()> {
    let temp_dir = destination
        .filter(|destination| matches!(destination, SaveDestination::Audit(_)))
        .map(|_| lighthouse_temp_dir(workspace));
    let output_dir = match destination {
        Some(SaveDestination::Directory(folder)) => Some(folder.as_path()),
        Some(SaveDestination::Audit(_)) => temp_dir.as_deref(),
        None => None,
    };

    if let Some(folder) = output_dir {
        fs::create_dir_all(folder)?;
    }

    let paths = ui::with_task("Running Lighthouse", || {
        lighthouse::run_lighthouse(&workspace.root, target, output_dir)
    })?;
    print_lighthouse_output(&paths.cli_output);

    match destination {
        Some(SaveDestination::Audit(folder)) => save_lighthouse_summary(workspace, folder, &paths)?,
        Some(SaveDestination::Directory(_)) | None => {
            ui::saved(paths.markdown_path.display());
            ui::saved(paths.json_path.display());
        }
    }

    if let Some(folder) = temp_dir {
        let _ = fs::remove_dir_all(folder);
    }

    Ok(())
}

fn print_lighthouse_output(output: &str) {
    if !output.trim().is_empty() {
        println!("{output}");
    }
}

fn save_lighthouse_summary(
    workspace: &Workspace,
    folder: &str,
    paths: &lighthouse::LighthousePaths,
) -> Result<()> {
    let markdown = fs::read_to_string(&paths.markdown_path)?;
    let json = fs::read_to_string(&paths.json_path)?;
    let workspace_path =
        workspace.update_workspace_section(folder, "Lighthouse Check", &markdown)?;
    let json_path = workspace.write_audit_file(folder, "raw/lighthouse.json", &json)?;
    ui::saved(workspace_path.display());
    ui::saved(json_path.display());
    Ok(())
}

fn write_save_file(folder: &Path, filename: &str, content: &str) -> Result<PathBuf> {
    fs::create_dir_all(folder).with_context(|| format!("Creating {}", folder.display()))?;
    let path = folder.join(filename);
    fs::write(&path, content).with_context(|| format!("Writing {}", path.display()))?;
    Ok(path)
}

fn lighthouse_temp_dir(workspace: &Workspace) -> PathBuf {
    workspace.root.join("target").join(format!(
        "auditkit-lighthouse-{}-{}",
        process::id(),
        Local::now().timestamp_millis()
    ))
}

fn generate_report(workspace: &Workspace, target: Option<&str>) -> Result<()> {
    let folder = workspace.resolve_target(target)?;
    let (report_path, email_path) =
        ui::with_task("Building final report and client email", || {
            report::generate_report(workspace, &folder)
        })?;
    ui::section("Report Generated");
    ui::saved(report_path.display());
    ui::saved(email_path.display());
    Ok(())
}

fn audit_website(workspace: &Workspace, folder: &str) -> Result<String> {
    let files = workspace.read_audit_files(folder)?;
    let brief = files.get("brief.md").context("Missing brief.md")?;
    let parsed = report::parse_brief(brief);
    if parsed.website.is_empty() {
        anyhow::bail!("No website found in {folder}/brief.md");
    }
    Ok(parsed.website)
}

fn target_or_prompt(label: &str, placeholder: &str, target: Option<&str>) -> Result<TargetInput> {
    if let Some(value) = target {
        return Ok(TargetInput {
            value: value.to_string(),
            prompted: false,
        });
    }

    if ui::can_prompt() {
        return Ok(TargetInput {
            value: ui::prompt_required(label, placeholder)?,
            prompted: true,
        });
    }

    anyhow::bail!("Missing target. Use `ak check <url>` or run `ak check` in a terminal.")
}

fn suggested_save_folder(target: &str) -> String {
    let slug = Url::parse(target)
        .ok()
        .and_then(|url| url.host_str().map(slugify))
        .filter(|slug| !slug.is_empty())
        .unwrap_or_else(|| slugify(target));
    let slug = if slug.is_empty() { "audit" } else { &slug };
    format!("./auditkit-{slug}")
}

fn expand_path(value: &str) -> Result<PathBuf> {
    let path = if value == "~" {
        home_dir().context("HOME is not set")?
    } else if let Some(rest) = value.strip_prefix("~/") {
        home_dir().context("HOME is not set")?.join(rest)
    } else {
        PathBuf::from(value)
    };

    if path.is_absolute() {
        Ok(path)
    } else {
        Ok(env::current_dir()?.join(path))
    }
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

fn looks_like_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://") || value.contains('.')
}
