use std::io::{self, IsTerminal, Write};
use std::time::Duration;

use anyhow::{bail, Result};
use colored::Colorize;
use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use indicatif::{ProgressBar, ProgressStyle};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Gauge, Paragraph},
    Frame, Terminal,
};

pub struct NewAuditAnswers {
    pub client_name: String,
    pub url: String,
    pub business_type: String,
    pub goal: String,
    pub target_customer: String,
    pub conversion_action: String,
    pub pages: String,
    pub known_concerns: String,
    pub competitors: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeedbackTone {
    Positive,
    Warning,
    Critical,
}

pub fn section(title: &str) {
    println!("\n{}", format!("╭─ {title} ").bold().cyan());
}

pub fn bullet(value: &str) {
    println!("  {} {value}", "•".cyan());
}

pub fn saved(path: impl std::fmt::Display) {
    println!("{} {}", "✓ saved".green().bold(), path);
}

pub fn error(message: impl std::fmt::Display) {
    eprintln!("{} {}", "✕ error".red().bold(), message);
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

pub fn score_badge(score: i32) -> String {
    let value = format!("{score}/100 ({})", score_status(score));
    match score {
        85..=100 => value.green().bold().to_string(),
        65..=84 => value.yellow().bold().to_string(),
        _ => value.red().bold().to_string(),
    }
}

pub fn signal_line(label: &str, value: impl std::fmt::Display, tone: FeedbackTone) -> String {
    let label = format!("{label:<21}").dimmed();
    let value = value.to_string();
    let value = match tone {
        FeedbackTone::Positive => value.green().bold().to_string(),
        FeedbackTone::Warning => value.yellow().bold().to_string(),
        FeedbackTone::Critical => value.red().bold().to_string(),
    };
    format!("  {} {} {}", tone_icon(tone), label, value)
}

pub fn feedback_line(tone: FeedbackTone, value: &str) -> String {
    let label = match tone {
        FeedbackTone::Positive => "OK".green().bold().to_string(),
        FeedbackTone::Warning => "WATCH".yellow().bold().to_string(),
        FeedbackTone::Critical => "FIX".red().bold().to_string(),
    };
    let value = match tone {
        FeedbackTone::Positive => value.dimmed().to_string(),
        FeedbackTone::Warning => value.yellow().to_string(),
        FeedbackTone::Critical => value.red().bold().to_string(),
    };
    format!("  {} {:<9} {}", tone_icon(tone), label, value)
}

pub fn frame_line(value: &str) -> String {
    value.cyan().bold().to_string()
}

fn tone_icon(tone: FeedbackTone) -> String {
    match tone {
        FeedbackTone::Positive => "✓".green().bold().to_string(),
        FeedbackTone::Warning => "◆".yellow().bold().to_string(),
        FeedbackTone::Critical => "●".red().bold().to_string(),
    }
}

pub fn with_task<T>(label: &str, task: impl FnOnce() -> Result<T>) -> Result<T> {
    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .unwrap_or_else(|_| ProgressStyle::default_spinner())
            .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
    );
    spinner.set_message(label.to_string());
    spinner.enable_steady_tick(Duration::from_millis(70));

    match task() {
        Ok(value) => {
            spinner.finish_and_clear();
            println!("{} {label}", "✓".green().bold());
            Ok(value)
        }
        Err(error) => {
            spinner.finish_and_clear();
            eprintln!("{} {label}", "✕".red().bold());
            Err(error)
        }
    }
}

pub fn help() {
    let title = format!("{:<72}", "Audit Kit").bold().cyan();
    println!();
    println!(
        "{}",
        "╭──────────────────────────────────────────────────────────────────────────╮".cyan()
    );
    println!("{} {} {}", "│".cyan(), title, "│".cyan());
    println!(
        "{}",
        "├──────────────────────────────────────────────────────────────────────────┤".cyan()
    );
    help_row("ak new", "create an audit workspace");
    help_row("ak list", "show audit folders");
    help_row("ak inspect latest", "run check, security, and Lighthouse");
    help_row("ak report latest", "create final report and client email");
    help_row("ak check <url>", "quick one-off website feedback");
    help_row("ak security <url>", "quick one-off security check");
    help_row("ak lighthouse <url>", "quick one-off Lighthouse check");
    println!(
        "{}",
        "╰──────────────────────────────────────────────────────────────────────────╯".cyan()
    );
}

pub fn collect_audit_input() -> Result<NewAuditAnswers> {
    if io::stdin().is_terminal() && io::stdout().is_terminal() {
        run_form()
    } else {
        fallback_prompts()
    }
}

fn help_row(command: &str, description: &str) {
    let command = format!("{command:<23}").bold();
    let description = format!("{description:<45}").dimmed();
    println!("{}  {} {} {}", "│".cyan(), command, description, "│".cyan());
}

fn fallback_prompts() -> Result<NewAuditAnswers> {
    Ok(NewAuditAnswers {
        client_name: prompt("Client name            ")?,
        url: prompt("Website URL            ")?,
        business_type: prompt("Business type          ")?,
        goal: prompt("Primary goal           ")?,
        target_customer: prompt("Target customer        ")?,
        conversion_action: prompt("Main conversion action ")?,
        pages: prompt("Pages, comma-separated ")?,
        known_concerns: prompt("Known concerns         ")?,
        competitors: prompt("Competitors            ")?,
    })
}

fn prompt(label: &str) -> Result<String> {
    print!("{}", label.cyan());
    io::stdout().flush()?;
    let mut value = String::new();
    io::stdin().read_line(&mut value)?;
    Ok(value.trim().to_string())
}

fn run_form() -> Result<NewAuditAnswers> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    let result = run_form_loop(&mut terminal);
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    result
}

fn run_form_loop(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<NewAuditAnswers> {
    let mut form = AuditForm::new();

    loop {
        terminal.draw(|frame| draw_form(frame, &form))?;
        if event::poll(Duration::from_millis(110))? {
            if let Event::Key(key) = event::read()? {
                if key.kind == KeyEventKind::Press {
                    match form.handle_key(key)? {
                        FormAction::Continue => {}
                        FormAction::Submit => return form.answers(),
                        FormAction::Cancel => bail!("Audit creation cancelled."),
                    }
                }
            }
        } else {
            form.tick = form.tick.wrapping_add(1);
        }
    }
}

fn draw_form(frame: &mut Frame, form: &AuditForm) {
    let area = centered(frame.area(), 86, 33);
    let shell = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Cyan))
        .title(Span::styled(
            " Audit Kit ",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ))
        .title_alignment(Alignment::Center);
    frame.render_widget(shell, area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(2)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(19),
            Constraint::Length(4),
        ])
        .split(area);

    let header = Paragraph::new(vec![
        Line::from(vec![
            Span::styled(
                "New audit workspace",
                Style::default()
                    .fg(Color::White)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw("  "),
            Span::styled(
                "capture the brief once, then run inspect",
                Style::default().fg(Color::DarkGray),
            ),
        ]),
        Line::from(Span::styled(
            "Tab or Enter to move, Shift+Tab to go back, Ctrl+S to create, Esc to cancel",
            Style::default().fg(Color::DarkGray),
        )),
    ]);
    frame.render_widget(header, chunks[0]);

    let completed = form
        .fields
        .iter()
        .filter(|field| !field.value.trim().is_empty())
        .count();
    let ratio = completed as f64 / form.fields.len() as f64;
    let gauge = Gauge::default()
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Progress: completed fields "),
        )
        .gauge_style(Style::default().fg(Color::Cyan))
        .label(format!("{completed}/{} fields", form.fields.len()))
        .ratio(ratio);
    frame.render_widget(gauge, chunks[1]);

    let field_panel = Paragraph::new(field_lines(form)).block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray))
            .title(" Fields "),
    );
    frame.render_widget(field_panel, chunks[2]);

    let active_field = &form.fields[form.active];
    let required = if active_field.required {
        Span::styled("Required", Style::default().fg(Color::Yellow))
    } else {
        Span::styled("Optional", Style::default().fg(Color::DarkGray))
    };
    let footer = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("Field help: ", Style::default().fg(Color::Cyan)),
            Span::styled(active_field.help, Style::default().fg(Color::Reset)),
        ]),
        Line::from(vec![
            required,
            Span::styled(
                "  •  Progress fills when a field has any text",
                Style::default().fg(Color::DarkGray),
            ),
        ]),
    ])
    .block(
        Block::default()
            .borders(Borders::TOP)
            .border_style(Style::default().fg(Color::DarkGray)),
    );
    frame.render_widget(footer, chunks[3]);
}

fn field_lines(form: &AuditForm) -> Vec<Line<'_>> {
    form.fields
        .iter()
        .enumerate()
        .map(|(index, field)| {
            let active = index == form.active;
            let marker = if active { "▶" } else { " " };
            let cursor = if active && (form.tick / 5).is_multiple_of(2) {
                "▌"
            } else {
                ""
            };
            let label_style = if active {
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::DarkGray)
            };
            let value_style = if field.value.is_empty() {
                Style::default().fg(Color::DarkGray)
            } else if active {
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default()
                    .fg(Color::Green)
                    .add_modifier(Modifier::BOLD)
            };
            let value = if field.value.is_empty() {
                field.placeholder
            } else {
                field.value.as_str()
            };

            Line::from(vec![
                Span::styled(format!(" {marker} "), label_style),
                Span::styled(format!("{:<24}", field.label), label_style),
                Span::styled(value, value_style),
                Span::styled(cursor, Style::default().fg(Color::Yellow)),
            ])
        })
        .collect()
}

fn centered(area: Rect, max_width: u16, max_height: u16) -> Rect {
    let width = area.width.min(max_width);
    let height = area.height.min(max_height);
    let horizontal = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Length((area.width.saturating_sub(width)) / 2),
            Constraint::Length(width),
            Constraint::Min(0),
        ])
        .split(area);
    let vertical = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length((area.height.saturating_sub(height)) / 2),
            Constraint::Length(height),
            Constraint::Min(0),
        ])
        .split(horizontal[1]);
    vertical[1]
}

struct FormField {
    label: &'static str,
    placeholder: &'static str,
    help: &'static str,
    required: bool,
    value: String,
}

struct AuditForm {
    fields: Vec<FormField>,
    active: usize,
    tick: usize,
}

enum FormAction {
    Continue,
    Submit,
    Cancel,
}

impl AuditForm {
    fn new() -> Self {
        Self {
            fields: vec![
                FormField {
                    label: "Client name",
                    placeholder: "Acme Dental",
                    help: "The client or business name used for the audit folder and report titles.",
                    required: true,
                    value: String::new(),
                },
                FormField {
                    label: "Website URL",
                    placeholder: "https://example.com",
                    help: "The website Audit Kit will inspect for HTML, security, and Lighthouse checks.",
                    required: true,
                    value: String::new(),
                },
                FormField {
                    label: "Business type",
                    placeholder: "Local service business, SaaS, ecommerce...",
                    help: "A short category that gives the final report useful business context.",
                    required: false,
                    value: String::new(),
                },
                FormField {
                    label: "Primary goal",
                    placeholder: "More demo bookings, quote requests, sales...",
                    help: "The main business outcome the website should improve.",
                    required: false,
                    value: String::new(),
                },
                FormField {
                    label: "Target customer",
                    placeholder: "Who the site needs to persuade",
                    help: "The buyer or audience the website needs to win over.",
                    required: false,
                    value: String::new(),
                },
                FormField {
                    label: "Main conversion action",
                    placeholder: "Book a call, buy now, request a quote...",
                    help: "The primary action visitors should take after reading the page.",
                    required: false,
                    value: String::new(),
                },
                FormField {
                    label: "Pages",
                    placeholder: "/, /pricing, /contact",
                    help: "Comma-separated page paths to create review templates for.",
                    required: false,
                    value: String::new(),
                },
                FormField {
                    label: "Known concerns",
                    placeholder: "Slow site, weak offer, low conversions...",
                    help: "Comma-separated issues the client already suspects or wants checked.",
                    required: false,
                    value: String::new(),
                },
                FormField {
                    label: "Competitors",
                    placeholder: "competitor.com, anotherbrand.com",
                    help: "Comma-separated competitor sites for context while writing findings.",
                    required: false,
                    value: String::new(),
                },
            ],
            active: 0,
            tick: 0,
        }
    }

    fn handle_key(&mut self, key: KeyEvent) -> Result<FormAction> {
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            return Ok(FormAction::Cancel);
        }
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('s') {
            return Ok(FormAction::Submit);
        }

        match key.code {
            KeyCode::Esc => Ok(FormAction::Cancel),
            KeyCode::Tab | KeyCode::Down => {
                self.next();
                Ok(FormAction::Continue)
            }
            KeyCode::BackTab | KeyCode::Up => {
                self.previous();
                Ok(FormAction::Continue)
            }
            KeyCode::Enter => {
                if self.active + 1 == self.fields.len() {
                    Ok(FormAction::Submit)
                } else {
                    self.next();
                    Ok(FormAction::Continue)
                }
            }
            KeyCode::Backspace => {
                self.fields[self.active].value.pop();
                Ok(FormAction::Continue)
            }
            KeyCode::Char(value) => {
                self.fields[self.active].value.push(value);
                Ok(FormAction::Continue)
            }
            _ => Ok(FormAction::Continue),
        }
    }

    fn next(&mut self) {
        self.active = (self.active + 1).min(self.fields.len() - 1);
    }

    fn previous(&mut self) {
        self.active = self.active.saturating_sub(1);
    }

    fn answers(&self) -> Result<NewAuditAnswers> {
        if self.fields[0].value.trim().is_empty() {
            bail!("Client name is required.");
        }
        if self.fields[1].value.trim().is_empty() {
            bail!("Website URL is required.");
        }

        Ok(NewAuditAnswers {
            client_name: self.value(0),
            url: self.value(1),
            business_type: self.value(2),
            goal: self.value(3),
            target_customer: self.value(4),
            conversion_action: self.value(5),
            pages: self.value(6),
            known_concerns: self.value(7),
            competitors: self.value(8),
        })
    }

    fn value(&self, index: usize) -> String {
        self.fields[index].value.trim().to_string()
    }
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

    #[test]
    fn form_moves_between_fields_and_collects_values() {
        let mut form = AuditForm::new();
        form.handle_key(KeyEvent::new(KeyCode::Char('A'), KeyModifiers::NONE))
            .unwrap();
        form.handle_key(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::NONE))
            .unwrap();
        form.handle_key(KeyEvent::new(KeyCode::Tab, KeyModifiers::NONE))
            .unwrap();
        form.handle_key(KeyEvent::new(KeyCode::Char('h'), KeyModifiers::NONE))
            .unwrap();
        assert_eq!(form.active, 1);
        assert_eq!(form.fields[0].value, "Ac");
        assert_eq!(form.fields[1].value, "h");
    }

    #[test]
    fn form_requires_client_name_and_url() {
        let form = AuditForm::new();
        assert!(form.answers().is_err());
    }
}
