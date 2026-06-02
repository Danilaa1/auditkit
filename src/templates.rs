use std::collections::BTreeMap;

use url::Url;

use crate::audit::AuditInput;

fn markdown_list(items: &[String]) -> String {
    if items.is_empty() {
        "- None provided".to_string()
    } else {
        items
            .iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

fn title_case(value: &str) -> String {
    if value == "/" {
        return "Homepage".to_string();
    }

    value
        .trim_matches('/')
        .replace(['-', '_', '/'], " ")
        .split_whitespace()
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

fn page_file_name(page: &str) -> String {
    let raw = if page == "/" {
        "home".to_string()
    } else {
        page.trim_matches('/').to_string()
    };

    let mut slug = String::new();
    let mut previous_dash = false;

    for character in raw.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            slug.push('-');
            previous_dash = true;
        }
    }

    format!("pages/{}.md", slug.trim_matches('-'))
}

pub fn create_audit_files(audit: &AuditInput) -> BTreeMap<String, String> {
    let mut files = BTreeMap::new();

    files.insert("brief.md".to_string(), brief_template(audit));
    files.insert("status.md".to_string(), status_template());
    files.insert("scorecard.md".to_string(), scorecard_template());
    files.insert("checklist.md".to_string(), checklist_template());
    files.insert("findings.md".to_string(), findings_template());
    files.insert("report.md".to_string(), report_template(audit));
    files.insert("video-script.md".to_string(), video_script_template(audit));
    files.insert("links.md".to_string(), links_template(audit));
    files.insert("raw-notes.md".to_string(), "# Raw Notes\n\n".to_string());

    for page in &audit.pages {
        files.insert(page_file_name(page), page_review_template(page));
    }

    files
}

pub fn brief_template(audit: &AuditInput) -> String {
    format!(
        "# {} Audit Brief\n\nWebsite: {}\nBusiness type: {}\nGoal: {}\nTarget customer: {}\nMain conversion action: {}\nCreated: {}\n\n## Known Concerns\n\n{}\n\n## Pages\n\n{}\n\n## Competitors\n\n{}\n",
        audit.client_name,
        audit.url,
        audit.business_type,
        audit.goal,
        audit.target_customer,
        audit.conversion_action,
        audit.created_at,
        markdown_list(&audit.known_concerns),
        markdown_list(&audit.pages),
        markdown_list(&audit.competitors)
    )
}

pub fn checklist_template() -> String {
    "# Audit Checklist\n\n## Performance\n\n- [ ] Run PageSpeed on key pages\n- [ ] Check mobile score\n- [ ] Identify LCP element\n- [ ] Check image weight\n- [ ] Check font loading\n- [ ] Check layout shift\n\n## UX and Conversion\n\n- [ ] Above-fold offer is clear\n- [ ] Primary CTA is obvious\n- [ ] User can contact/book within 1 click\n- [ ] Trust signals are visible\n- [ ] Forms are short enough\n- [ ] Navigation supports key journey\n\n## SEO\n\n- [ ] Title tags\n- [ ] Meta descriptions\n- [ ] H1 structure\n- [ ] Internal links\n- [ ] Image alt text\n- [ ] Schema opportunity\n- [ ] Local SEO basics\n".to_string()
}

pub fn findings_template() -> String {
    "# Findings\n\n## Finding Template\n\nTitle:\nCategory: Performance / UX / SEO / Conversion / Trust\nSeverity: Critical / High / Medium / Low\nPage:\nEvidence:\nWhy it matters:\nRecommendation:\nEstimated effort:\nBusiness impact:\nScreenshot/video note:\n\n## Critical\n\n### 1. Finding title\n\nEvidence:\n\nWhy it matters:\n\nRecommendation:\n\nEstimated effort:\n\nBusiness impact:\n\n## High\n\n## Medium\n\n## Low\n".to_string()
}

pub fn scorecard_template() -> String {
    "# Scorecard\n\nPerformance: /10\nUX clarity: /10\nConversion path: /10\nSEO basics: /10\nTrust signals: /10\nMobile experience: /10\n\nOverall:\n\n## Notes\n\n".to_string()
}

pub fn status_template() -> String {
    "# Audit Status\n\n- [ ] Intake complete\n- [ ] Pages reviewed\n- [ ] Performance checked\n- [ ] SEO checked\n- [ ] Findings prioritised\n- [ ] Report drafted\n- [ ] Video recorded\n- [ ] Sent to client\n".to_string()
}

pub fn page_review_template(page: &str) -> String {
    format!(
        "# {} Review\n\nPath: {}\n\n## First Impression\n\n## CTA\n\n## Copy Clarity\n\n## Visual Hierarchy\n\n## Mobile Issues\n\n## SEO Notes\n\n## Performance Notes\n\n## Recommended Fixes\n",
        title_case(page),
        page
    )
}

pub fn report_template(audit: &AuditInput) -> String {
    format!(
        "# {} Website Audit\n\nWebsite: {}\nGoal: {}\n\n## Executive Summary\n\n## Priority Fixes\n\n1.\n2.\n3.\n\n## Performance\n\n## UX and Conversion\n\n## SEO\n\n## Recommended Next Step\n",
        audit.client_name, audit.url, audit.goal
    )
}

pub fn video_script_template(audit: &AuditInput) -> String {
    format!(
        "# {} Video Script\n\n## Opening\n\nWhat I reviewed and what matters most.\n\n## Biggest Conversion Issue\n\n## Performance Issue\n\n## SEO or Structure Issue\n\n## Close\n\nSummarise top 3 fixes and recommended next step.\n",
        audit.client_name
    )
}

pub fn links_template(audit: &AuditInput) -> String {
    let encoded = urlencoding(&audit.url);
    let pages = audit
        .pages
        .iter()
        .map(|page| {
            Url::parse(&audit.url)
                .and_then(|base| base.join(page))
                .map(|url| format!("- {url}"))
                .unwrap_or_else(|_| format!("- {page}"))
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "# Audit Links\n\n## Test Links\n\n- PageSpeed: https://pagespeed.web.dev/analysis?url={}\n- Rich Results: https://search.google.com/test/rich-results?url={}\n- Meta Preview: https://metatags.io/?url={}\n\n## Pages\n\n{}\n\n## Competitors\n\n{}\n",
        encoded,
        encoded,
        encoded,
        if pages.is_empty() { "- None provided".to_string() } else { pages },
        markdown_list(&audit.competitors)
    )
}

fn urlencoding(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn audit() -> AuditInput {
        AuditInput {
            client_name: "Acme Dental".to_string(),
            slug: "acme-dental".to_string(),
            url: "https://acmedental.co.uk".to_string(),
            business_type: "Dental clinic".to_string(),
            goal: "More bookings".to_string(),
            target_customer: "Local families".to_string(),
            conversion_action: "Book consultation".to_string(),
            pages: vec!["/".to_string(), "/pricing".to_string(), "/contact".to_string()],
            known_concerns: vec!["Slow mobile".to_string()],
            competitors: vec!["https://competitor.example".to_string()],
            created_at: "2026-06-02".to_string(),
        }
    }

    #[test]
    fn create_audit_files_contains_expected_workspace() {
        let files = create_audit_files(&audit());
        assert!(files.contains_key("brief.md"));
        assert!(files.contains_key("scorecard.md"));
        assert!(files.contains_key("pages/home.md"));
        assert!(files.contains_key("pages/pricing.md"));
        assert!(files["brief.md"].contains("Business type: Dental clinic"));
    }
}
