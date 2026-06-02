#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuditInput {
    pub client_name: String,
    pub slug: String,
    pub url: String,
    pub business_type: String,
    pub goal: String,
    pub target_customer: String,
    pub conversion_action: String,
    pub pages: Vec<String>,
    pub known_concerns: Vec<String>,
    pub competitors: Vec<String>,
    pub created_at: String,
}

pub fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut previous_dash = false;

    for character in value.trim().to_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
            previous_dash = false;
        } else if !previous_dash {
            slug.push('-');
            previous_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

pub fn split_comma_list(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_makes_folder_safe_names() {
        assert_eq!(slugify("Acme Dental Ltd"), "acme-dental-ltd");
        assert_eq!(slugify("  My Kind_of Cruise! "), "my-kind-of-cruise");
    }

    #[test]
    fn split_comma_list_ignores_empty_items() {
        assert_eq!(
            split_comma_list("/, /pricing, , /contact"),
            vec!["/", "/pricing", "/contact"]
        );
    }
}
