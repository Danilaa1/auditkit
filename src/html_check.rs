use anyhow::Result;
use regex::Regex;

use crate::ui::score_status;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HtmlCheck {
    pub url: String,
    pub score: i32,
    pub status: u16,
    pub bytes: usize,
    pub title: String,
    pub meta_description_present: bool,
    pub h1_count: usize,
    pub image_total: usize,
    pub image_missing_alt: usize,
    pub feedback: Vec<String>,
}

fn normalise_url(value: &str) -> String {
    if value.starts_with("http://") || value.starts_with("https://") {
        value.to_string()
    } else {
        format!("https://{value}")
    }
}

fn strip_tags(value: &str) -> String {
    Regex::new(r"<[^>]*>")
        .expect("valid regex")
        .replace_all(value, " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn first_capture(html: &str, pattern: &str) -> String {
    Regex::new(pattern)
        .expect("valid regex")
        .captures(html)
        .and_then(|captures| captures.get(1))
        .map(|match_value| strip_tags(match_value.as_str().trim()))
        .unwrap_or_default()
}

fn contains_cta(html: &str) -> bool {
    let text = strip_tags(html).to_lowercase();
    [
        "book",
        "buy",
        "call",
        "contact",
        "demo",
        "enquire",
        "get started",
        "quote",
        "schedule",
        "start",
    ]
    .iter()
    .any(|word| text.contains(word))
}

fn tag_has_attribute(html: &str, tag_pattern: &str, required_parts: &[&str]) -> bool {
    let tag_regex = Regex::new(tag_pattern).expect("valid regex");
    let found = tag_regex.find_iter(html).any(|tag| {
        let lower = tag.as_str().to_lowercase();
        required_parts.iter().all(|part| lower.contains(part))
    });
    found
}

pub fn analyze_html(url: &str, html: &str, status: u16, bytes: usize) -> HtmlCheck {
    let title = first_capture(html, r"(?is)<title\b[^>]*>(.*?)</title>");
    let meta_description_present = tag_has_attribute(
        html,
        r#"(?is)<meta\b[^>]*>"#,
        &["name=\"description\"", "content="],
    ) || tag_has_attribute(
        html,
        r#"(?is)<meta\b[^>]*>"#,
        &["name='description'", "content="],
    );
    let h1_count = Regex::new(r"(?is)<h1\b[^>]*>.*?</h1>")
        .expect("valid regex")
        .find_iter(html)
        .count();
    let images = Regex::new(r#"(?is)<img\b[^>]*>"#).expect("valid regex");
    let image_total = images.find_iter(html).count();
    let image_missing_alt = images
        .find_iter(html)
        .filter(|image| {
            !Regex::new(r#"\balt\s*=\s*["'][^"']+["']"#)
                .expect("valid regex")
                .is_match(image.as_str())
        })
        .count();
    let has_viewport = tag_has_attribute(html, r#"(?is)<meta\b[^>]*>"#, &["name=\"viewport\""])
        || tag_has_attribute(html, r#"(?is)<meta\b[^>]*>"#, &["name='viewport'"]);
    let has_canonical = tag_has_attribute(html, r#"(?is)<link\b[^>]*>"#, &["rel=\"canonical\""])
        || tag_has_attribute(html, r#"(?is)<link\b[^>]*>"#, &["rel='canonical'"]);
    let has_cta = contains_cta(html);

    let mut score = 100;
    let mut feedback = Vec::new();

    if title.is_empty() {
        score -= 15;
        feedback.push(
            "Missing title tag. Add a clear page title for search results and browser tabs."
                .to_string(),
        );
    } else if title.len() < 10 || title.len() > 65 {
        score -= 8;
        feedback.push(format!(
            "Title length is {}. Aim for roughly 10-65 characters.",
            title.len()
        ));
    } else {
        feedback.push(format!("Title found: \"{title}\"."));
    }

    if !meta_description_present {
        score -= 12;
        feedback.push(
            "Missing meta description. Add a concise summary for search snippets.".to_string(),
        );
    } else {
        feedback.push("Meta description found.".to_string());
    }

    if h1_count == 0 {
        score -= 12;
        feedback.push("Missing H1. Add one clear primary heading.".to_string());
    } else if h1_count > 1 {
        score -= 8;
        feedback.push(format!(
            "Multiple H1 tags found ({h1_count}). Keep one primary page heading."
        ));
    } else {
        feedback.push("Single H1 found.".to_string());
    }

    if image_missing_alt > 0 {
        score -= (image_missing_alt as i32 * 8).min(15);
        feedback.push(format!("{image_missing_alt} image(s) missing alt text."));
    }

    if !has_viewport {
        score -= 10;
        feedback.push("Missing viewport meta tag. Mobile layout may render poorly.".to_string());
    }

    if !has_canonical {
        score -= 4;
        feedback
            .push("No canonical link found. Add one if duplicate URLs are possible.".to_string());
    }

    if !has_cta {
        score -= 10;
        feedback.push("No obvious CTA language found. Make the next action clear.".to_string());
    } else {
        feedback.push("Primary CTA found.".to_string());
    }

    if bytes > 200_000 {
        score -= 7;
        feedback.push(
            "HTML response is large. Check unnecessary markup, scripts, or inline payloads."
                .to_string(),
        );
    }

    HtmlCheck {
        url: url.to_string(),
        score: score.max(0),
        status,
        bytes,
        title,
        meta_description_present,
        h1_count,
        image_total,
        image_missing_alt,
        feedback,
    }
}

pub fn check_url(input_url: &str) -> Result<HtmlCheck> {
    let url = normalise_url(input_url);
    let response = reqwest::blocking::Client::new()
        .get(&url)
        .header("user-agent", "AuditKit/0.1")
        .header("accept", "text/html,application/xhtml+xml")
        .send()?;
    let final_url = response.url().to_string();
    let status = response.status().as_u16();
    let html = response.text()?;
    Ok(analyze_html(&final_url, &html, status, html.len()))
}

pub fn format_cli(result: &HtmlCheck) -> String {
    let mut output = format!(
        "\n╭─ Audit Kit Check\n│ URL      {}\n│ Score    {}/100 ({})\n╰─ Signals\n  • Status               {}\n  • Response             {} bytes\n  • Title                {}\n  • Meta description     {}\n  • H1 count             {}\n  • Images missing alt   {}/{}\n\nFeedback\n",
        result.url,
        result.score,
        score_status(result.score),
        result.status,
        result.bytes,
        if result.title.is_empty() { "missing" } else { &result.title },
        if result.meta_description_present { "present" } else { "missing" },
        result.h1_count,
        result.image_missing_alt,
        result.image_total
    );

    for item in &result.feedback {
        output.push_str(&format!("- {item}\n"));
    }

    output
}

pub fn format_markdown(result: &HtmlCheck) -> String {
    format!("# Automated Check\n\n{}\n", format_cli(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analyze_html_finds_useful_feedback() {
        let html = r#"<title>Acme Dental</title><meta name="description" content="Dental care"><h1>Care</h1><a>Book now</a><img src="/x.jpg">"#;
        let result = analyze_html("https://example.com", html, 200, html.len());
        assert_eq!(result.score, 78);
        assert_eq!(result.image_missing_alt, 1);
        assert!(result.feedback.join("\n").contains("Primary CTA found"));
    }
}
