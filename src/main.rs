use std::{fs, process};

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
        target: String,
        #[arg(long)]
        save: Option<String>,
    },
    Security {
        target: Option<String>,
        #[arg(long)]
        save: Option<String>,
    },
    Lighthouse {
        target: Option<String>,
        #[arg(long)]
        save: Option<String>,
    },
    Inspect {
        target: Option<String>,
    },
    Report {
        target: Option<String>,
    },
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
        Some(Command::Check { target, save }) => check(&workspace, &target, save.as_deref()),
        Some(Command::Security { target, save }) => {
            security_check(&workspace, target.as_deref(), save.as_deref())
        }
        Some(Command::Lighthouse { target, save }) => {
            lighthouse_check(&workspace, target.as_deref(), save.as_deref())
        }
        Some(Command::Inspect { target }) => inspect(&workspace, target.as_deref()),
        Some(Command::Report { target }) => generate_report(&workspace, target.as_deref()),
        None => {
            ui::help();
            Ok(())
        }
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

fn check(workspace: &Workspace, target: &str, save: Option<&str>) -> Result<()> {
    if looks_like_url(target) {
        let result = ui::with_task("Fetching website and reading HTML", || {
            html_check::check_url(target)
        })?;
        println!("{}", html_check::format_cli(&result));
        if let Some(folder) = save {
            let folder = workspace.resolve_target(Some(folder))?;
            let path = workspace.update_workspace_section(
                &folder,
                "Automated Check",
                &html_check::format_markdown(&result),
            )?;
            ui::saved(path.display());
        }
        return Ok(());
    }

    let folder = workspace.resolve_target(Some(target))?;
    let website = audit_website(workspace, &folder)?;
    let result = ui::with_task("Fetching website and reading HTML", || {
        html_check::check_url(&website)
    })?;
    println!("{}", html_check::format_cli(&result));
    let path = workspace.update_workspace_section(
        &folder,
        "Automated Check",
        &html_check::format_markdown(&result),
    )?;
    ui::saved(path.display());
    Ok(())
}

fn security_check(workspace: &Workspace, target: Option<&str>, save: Option<&str>) -> Result<()> {
    let target = target.unwrap_or("latest");

    if looks_like_url(target) {
        let result = ui::with_task("Checking security headers", || security::check_url(target))?;
        println!("{}", security::format_cli(&result));
        if let Some(folder) = save {
            let folder = workspace.resolve_target(Some(folder))?;
            let path = workspace.update_workspace_section(
                &folder,
                "Security Check",
                &security::format_markdown(&result),
            )?;
            ui::saved(path.display());
        }
        return Ok(());
    }

    let folder = workspace.resolve_target(Some(target))?;
    let website = audit_website(workspace, &folder)?;
    let result = ui::with_task("Checking security headers", || {
        security::check_url(&website)
    })?;
    println!("{}", security::format_cli(&result));
    let path = workspace.update_workspace_section(
        &folder,
        "Security Check",
        &security::format_markdown(&result),
    )?;
    ui::saved(path.display());
    Ok(())
}

fn lighthouse_check(workspace: &Workspace, target: Option<&str>, save: Option<&str>) -> Result<()> {
    let target = target.unwrap_or("latest");

    if looks_like_url(target) {
        let save_folder = save
            .map(|folder| workspace.resolve_target(Some(folder)))
            .transpose()?;
        let temp_dir = save_folder.as_ref().map(|_| lighthouse_temp_dir(workspace));
        if let Some(folder) = &temp_dir {
            fs::create_dir_all(folder)?;
        }
        let paths = ui::with_task("Running Lighthouse in Helium", || {
            lighthouse::run_lighthouse(&workspace.root, target, temp_dir.as_deref())
        })?;
        print_lighthouse_output(&paths.cli_output);
        if let Some(folder) = save_folder {
            save_lighthouse_summary(workspace, &folder, &paths)?;
        } else {
            ui::saved(paths.markdown_path.display());
            ui::saved(paths.json_path.display());
        }
        if let Some(folder) = temp_dir {
            let _ = fs::remove_dir_all(folder);
        }
        return Ok(());
    }

    let folder = workspace.resolve_target(Some(target))?;
    let website = audit_website(workspace, &folder)?;
    let temp_dir = lighthouse_temp_dir(workspace);
    fs::create_dir_all(&temp_dir)?;
    let paths = ui::with_task("Running Lighthouse in Helium", || {
        lighthouse::run_lighthouse(&workspace.root, &website, Some(&temp_dir))
    })?;
    print_lighthouse_output(&paths.cli_output);
    save_lighthouse_summary(workspace, &folder, &paths)?;
    let _ = fs::remove_dir_all(temp_dir);
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

fn lighthouse_temp_dir(workspace: &Workspace) -> std::path::PathBuf {
    workspace.root.join("target").join(format!(
        "auditkit-lighthouse-{}-{}",
        process::id(),
        Local::now().timestamp_millis()
    ))
}

fn inspect(workspace: &Workspace, target: Option<&str>) -> Result<()> {
    let folder = workspace.resolve_target(target)?;
    ui::section("Inspect");
    ui::bullet(&format!("Running checks for {folder}"));
    check(workspace, &folder, None)?;
    security_check(workspace, Some(&folder), None)?;
    lighthouse_check(workspace, Some(&folder), None)?;
    Ok(())
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

fn looks_like_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://") || value.contains('.')
}
