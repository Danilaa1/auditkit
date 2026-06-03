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

pub fn create_audit_files(audit: &AuditInput) -> BTreeMap<String, String> {
    let mut files = BTreeMap::new();

    files.insert("brief.md".to_string(), brief_template(audit));
    files.insert("workspace.md".to_string(), workspace_template(audit));
    files.insert("findings.md".to_string(), findings_template());

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

pub fn findings_template() -> String {
    "# Findings\n\n## Critical\n\n## High\n\n## Medium\n\n## Low\n\n## Finding Template\n\nTitle:\nCategory: Performance / UX / SEO / Conversion / Trust\nSeverity: Critical / High / Medium / Low\nPage:\nEvidence:\nWhy it matters:\nRecommendation:\nEstimated effort:\nBusiness impact:\nScreenshot/video note:\n".to_string()
}

pub fn workspace_template(audit: &AuditInput) -> String {
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

    let page_reviews = audit
        .pages
        .iter()
        .map(|page| {
            format!(
                "### {} Review\n\nPath: {}\n\nFirst impression:\n\nCTA:\n\nCopy clarity:\n\nVisual hierarchy:\n\nMobile issues:\n\nSEO notes:\n\nPerformance notes:\n\nRecommended fixes:\n",
                title_case(page),
                page
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "# Audit Workspace\n\n## Status\n\n- [ ] Intake complete\n- [ ] Pages reviewed\n- [ ] Performance checked\n- [ ] SEO checked\n- [ ] Findings prioritised\n- [ ] Report drafted\n- [ ] Video recorded\n- [ ] Sent to client\n\n## Scorecard\n\nPerformance: /10\nUX clarity: /10\nConversion path: /10\nSEO basics: /10\nTrust signals: /10\nMobile experience: /10\n\nOverall:\n\nNotes:\n\n## Review Checklist\n\n### Performance\n\n- [ ] Check mobile score\n- [ ] Identify LCP element\n- [ ] Check image weight\n- [ ] Check font loading\n- [ ] Check layout shift\n\n### UX and Conversion\n\n- [ ] Above-fold offer is clear\n- [ ] Primary CTA is obvious\n- [ ] User can contact/book within 1 click\n- [ ] Trust signals are visible\n- [ ] Forms are short enough\n- [ ] Navigation supports key journey\n\n### SEO\n\n- [ ] Title tags\n- [ ] Meta descriptions\n- [ ] H1 structure\n- [ ] Internal links\n- [ ] Image alt text\n- [ ] Schema opportunity\n- [ ] Local SEO basics\n\n## Test Links\n\n- PageSpeed: https://pagespeed.web.dev/analysis?url={}\n- Rich Results: https://search.google.com/test/rich-results?url={}\n- Meta Preview: https://metatags.io/?url={}\n\n## Pages To Review\n\n{}\n\n## Competitors\n\n{}\n\n## Automated Check\n\nNot run yet.\n\n## Security Check\n\nNot run yet.\n\n## Lighthouse Check\n\nNot run yet.\n\n## Page Reviews\n\n{}\n\n## Raw Notes\n\n",
        encoded,
        encoded,
        encoded,
        if pages.is_empty() { "- None provided".to_string() } else { pages },
        markdown_list(&audit.competitors),
        if page_reviews.is_empty() { "No page reviews provided yet.".to_string() } else { page_reviews }
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
            pages: vec![
                "/".to_string(),
                "/pricing".to_string(),
                "/contact".to_string(),
            ],
            known_concerns: vec!["Slow mobile".to_string()],
            competitors: vec!["https://competitor.example".to_string()],
            created_at: "2026-06-02".to_string(),
        }
    }

    #[test]
    fn create_audit_files_contains_expected_workspace() {
        let files = create_audit_files(&audit());
        assert!(files.contains_key("brief.md"));
        assert!(files.contains_key("workspace.md"));
        assert!(files.contains_key("findings.md"));
        assert_eq!(files.len(), 3);
        assert!(files["brief.md"].contains("Business type: Dental clinic"));
        assert!(files["workspace.md"].contains("### Homepage Review"));
        assert!(files["workspace.md"].contains("## Automated Check"));
    }
}
