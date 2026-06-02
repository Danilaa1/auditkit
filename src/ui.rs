use std::time::Duration;

use anyhow::Result;
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};

pub fn section(title: &str) {
    println!("\n{}", format!("== {title} ==").bold());
}

pub fn bullet(value: &str) {
    println!("{} {value}", "-".cyan());
}

pub fn saved(path: impl std::fmt::Display) {
    println!("{} {}", "[saved]".green(), path);
}

pub fn error(message: impl std::fmt::Display) {
    eprintln!("{} {}", "[error]".red(), message);
}

pub fn score_status(score: i32) -> &'static str {
    if score >= 85 {
        "strong"
    } else if score >= 65 {
        "okay"
    } else {
        "needs work"
    }
}

pub fn with_task<T>(label: &str, task: impl FnOnce() -> Result<T>) -> Result<T> {
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .unwrap_or_else(|_| ProgressStyle::default_spinner()),
    );
    spinner.set_message(label.to_string());
    spinner.enable_steady_tick(Duration::from_millis(80));

    match task() {
        Ok(value) => {
            spinner.finish_with_message(format!("Done: {label}"));
            Ok(value)
        }
        Err(error) => {
            spinner.finish_with_message(format!("Failed: {label}"));
            Err(error)
        }
    }
}

pub fn help() {
    println!(
        "{}",
        "+--------------------------------------------------------+\n\
| Audit Kit                                              |\n\
+--------------------------------------------------------+\n\
| ak new              create audit workspace             |\n\
| ak check latest     run + save quick website feedback  |\n\
| ak security latest  run + save security header check   |\n\
| ak lighthouse latest run + save Lighthouse audit       |\n\
| ak inspect latest   run check + security + Lighthouse  |\n\
| ak report latest    create final report + client email |\n\
| ak list             show audit folders                 |\n\
| ak check <url>      quick one-off website check        |\n\
| ak security <url>   quick one-off security check       |\n\
| ak lighthouse <url> quick one-off Lighthouse check     |\n\
+--------------------------------------------------------+"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_status_matches_cli_labels() {
        assert_eq!(score_status(95), "strong");
        assert_eq!(score_status(74), "okay");
        assert_eq!(score_status(40), "needs work");
    }
}
