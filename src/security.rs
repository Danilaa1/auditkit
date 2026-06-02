use anyhow::Result;
use reqwest::header::HeaderMap;

use crate::ui::score_status;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecurityCheck {
    pub url: String,
    pub score: i32,
    pub https: bool,
    pub hsts: bool,
    pub csp: bool,
    pub frame_options: bool,
    pub referrer_policy: bool,
    pub secure_cookies: bool,
    pub feedback: Vec<String>,
}

fn header_present(headers: &HeaderMap, name: &str) -> bool {
    headers.get(name).is_some()
}

fn cookies_have_security_flags(headers: &HeaderMap) -> bool {
    let cookies = headers.get_all("set-cookie");
    let mut saw_cookie = false;

    for cookie in cookies.iter() {
        saw_cookie = true;
        let value = cookie.to_str().unwrap_or("").to_lowercase();
        if !(value.contains("secure") && value.contains("httponly") && value.contains("samesite")) {
            return false;
        }
    }

    !saw_cookie || true
}

pub fn analyze_security_headers(url: &str, headers: &HeaderMap) -> SecurityCheck {
    let https = url.starts_with("https://");
    let hsts = header_present(headers, "strict-transport-security");
    let csp = header_present(headers, "content-security-policy");
    let frame_options = header_present(headers, "x-frame-options");
    let referrer_policy = header_present(headers, "referrer-policy");
    let secure_cookies = cookies_have_security_flags(headers);

    let mut score = 100;
    let mut feedback = Vec::new();

    if !https {
        score -= 25;
        feedback.push(
            "Site is not using HTTPS. Serve the site over HTTPS before client launch.".to_string(),
        );
    } else {
        feedback.push("HTTPS is enabled.".to_string());
    }

    if !hsts {
        score -= 15;
        feedback.push(
            "Missing HSTS header. Add Strict-Transport-Security once HTTPS is stable.".to_string(),
        );
    } else {
        feedback.push("HSTS header found.".to_string());
    }

    if !csp {
        score -= 20;
        feedback.push(
            "Missing Content-Security-Policy. Add a CSP to reduce script injection risk."
                .to_string(),
        );
    } else {
        feedback.push("Content-Security-Policy found.".to_string());
    }

    if !frame_options {
        score -= 10;
        feedback.push("Missing X-Frame-Options. Add clickjacking protection.".to_string());
    }

    if !referrer_policy {
        score -= 5;
        feedback.push("Missing Referrer-Policy. Add one to avoid leaking full URLs.".to_string());
    }

    if !secure_cookies {
        score -= 10;
        feedback.push("Cookies are missing Secure, HttpOnly, or SameSite flags.".to_string());
    }

    SecurityCheck {
        url: url.to_string(),
        score: score.max(0),
        https,
        hsts,
        csp,
        frame_options,
        referrer_policy,
        secure_cookies,
        feedback,
    }
}

pub fn check_url(input_url: &str) -> Result<SecurityCheck> {
    let url = if input_url.starts_with("http://") || input_url.starts_with("https://") {
        input_url.to_string()
    } else {
        format!("https://{input_url}")
    };
    let response = reqwest::blocking::Client::new()
        .get(&url)
        .header("user-agent", "AuditKit/0.1")
        .header("accept", "text/html,application/xhtml+xml")
        .send()?;
    Ok(analyze_security_headers(
        &response.url().to_string(),
        response.headers(),
    ))
}

pub fn format_cli(result: &SecurityCheck) -> String {
    let mut output = format!(
        "\n== Security Check ==\nURL: {}\nScore: {}/100 ({})\n\n== Signals ==\nHTTPS: {}\nHSTS: {}\nCSP: {}\nX-Frame-Options: {}\nReferrer-Policy: {}\nSecure cookies: {}\n\n== Feedback ==\n",
        result.url,
        result.score,
        score_status(result.score),
        yes_no(result.https),
        yes_no(result.hsts),
        yes_no(result.csp),
        yes_no(result.frame_options),
        yes_no(result.referrer_policy),
        yes_no(result.secure_cookies)
    );

    for item in &result.feedback {
        output.push_str(&format!("- {item}\n"));
    }

    output
}

pub fn format_markdown(result: &SecurityCheck) -> String {
    format!("# Security Check\n\n{}\n", format_cli(result))
}

fn yes_no(value: bool) -> &'static str {
    if value {
        "yes"
    } else {
        "no"
    }
}

#[cfg(test)]
mod tests {
    use reqwest::header::{HeaderMap, HeaderValue};

    use super::*;

    #[test]
    fn missing_headers_are_flagged() {
        let headers = HeaderMap::new();
        let result = analyze_security_headers("http://example.com", &headers);
        assert_eq!(result.score, 25);
        assert!(result
            .feedback
            .join("\n")
            .contains("Site is not using HTTPS"));
        assert!(result
            .feedback
            .join("\n")
            .contains("Missing Content-Security-Policy"));
    }

    #[test]
    fn strong_headers_score_high() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "strict-transport-security",
            HeaderValue::from_static("max-age=31536000"),
        );
        headers.insert(
            "content-security-policy",
            HeaderValue::from_static("default-src 'self'"),
        );
        headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
        headers.insert("referrer-policy", HeaderValue::from_static("strict-origin"));

        let result = analyze_security_headers("https://example.com", &headers);
        assert_eq!(result.score, 100);
    }
}
