use regex::Regex;
use std::collections::HashSet;
use uuid::Uuid;
use once_cell::sync::Lazy;

#[derive(Debug, Clone, PartialEq)]
pub struct DocumentLink {
    pub target: LinkTarget,
    pub link_type: LinkType,
    pub link_text: Option<String>,
    pub position_start: usize,
    pub position_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum LinkTarget {
    Id(Uuid),
    Title(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum LinkType {
    Reference,
    Embed,
    Mention,
}

impl LinkType {
    pub fn as_str(&self) -> &'static str {
        match self {
            LinkType::Reference => "reference",
            LinkType::Embed => "embed",
            LinkType::Mention => "mention",
        }
    }
}

// Regex patterns for different link types
static WIKI_LINK_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]").unwrap()
});

static EMBED_LINK_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"!\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]").unwrap()
});

static MENTION_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"@\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]").unwrap()
});

pub struct LinkParser;

impl LinkParser {
    /// Parse markdown content and extract all document links
    pub fn parse_links(content: &str) -> Vec<DocumentLink> {
        let mut links = Vec::new();
        let mut processed_positions = HashSet::new();

        // Parse embed links first (they start with !)
        for cap in EMBED_LINK_REGEX.captures_iter(content) {
            let mat = cap.get(0).unwrap();
            let start = mat.start();
            let end = mat.end();
            
            if processed_positions.contains(&start) {
                continue;
            }
            processed_positions.insert(start);

            let target_text = cap.get(1).unwrap().as_str();
            let display_text = cap.get(2).map(|m| m.as_str().to_string());
            
            let target = Self::parse_target(target_text);
            
            links.push(DocumentLink {
                target,
                link_type: LinkType::Embed,
                link_text: display_text,
                position_start: start,
                position_end: end,
            });
        }

        // Parse mention links
        for cap in MENTION_REGEX.captures_iter(content) {
            let mat = cap.get(0).unwrap();
            let start = mat.start();
            let end = mat.end();
            
            if processed_positions.contains(&start) {
                continue;
            }
            processed_positions.insert(start);

            let target_text = cap.get(1).unwrap().as_str();
            let display_text = cap.get(2).map(|m| m.as_str().to_string());
            
            let target = Self::parse_target(target_text);
            
            links.push(DocumentLink {
                target,
                link_type: LinkType::Mention,
                link_text: display_text,
                position_start: start,
                position_end: end,
            });
        }

        // Parse regular wiki links
        for cap in WIKI_LINK_REGEX.captures_iter(content) {
            let mat = cap.get(0).unwrap();
            let start = mat.start();
            let end = mat.end();
            
            // Skip if this position was already processed (as embed or mention)
            if processed_positions.contains(&start) {
                continue;
            }
            
            let target_text = cap.get(1).unwrap().as_str();
            let display_text = cap.get(2).map(|m| m.as_str().to_string());
            
            let target = Self::parse_target(target_text);
            
            links.push(DocumentLink {
                target,
                link_type: LinkType::Reference,
                link_text: display_text,
                position_start: start,
                position_end: end,
            });
        }

        // Sort by position for consistent ordering
        links.sort_by_key(|link| link.position_start);
        
        links
    }

    /// Parse a target string into either a UUID or a title
    fn parse_target(target: &str) -> LinkTarget {
        let trimmed = target.trim();
        
        // Try to parse as UUID first
        if let Ok(uuid) = Uuid::parse_str(trimmed) {
            LinkTarget::Id(uuid)
        } else {
            LinkTarget::Title(trimmed.to_string())
        }
    }

    /// Extract unique document references from content
    pub fn extract_unique_references(content: &str) -> HashSet<LinkTarget> {
        let links = Self::parse_links(content);
        links.into_iter().map(|link| link.target).collect()
    }

    /// Replace link targets in content (useful for updating links when documents are renamed)
    pub fn update_link_targets<F>(content: &str, mut updater: F) -> String 
    where
        F: FnMut(&LinkTarget) -> Option<String>,
    {
        let links = Self::parse_links(content);
        let mut result = content.to_string();
        
        // Process links in reverse order to maintain positions
        for link in links.iter().rev() {
            if let Some(new_target) = updater(&link.target) {
                let link_content = match &link.link_type {
                    LinkType::Embed => {
                        if let Some(text) = &link.link_text {
                            format!("![[{}|{}]]", new_target, text)
                        } else {
                            format!("![[{}]]", new_target)
                        }
                    }
                    LinkType::Mention => {
                        if let Some(text) = &link.link_text {
                            format!("@[[{}|{}]]", new_target, text)
                        } else {
                            format!("@[[{}]]", new_target)
                        }
                    }
                    LinkType::Reference => {
                        if let Some(text) = &link.link_text {
                            format!("[[{}|{}]]", new_target, text)
                        } else {
                            format!("[[{}]]", new_target)
                        }
                    }
                };
                
                result.replace_range(link.position_start..link.position_end, &link_content);
            }
        }
        
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_wiki_links() {
        let content = "This is a [[Test Document]] and [[Another Document|custom text]].";
        let links = LinkParser::parse_links(content);
        
        assert_eq!(links.len(), 2);
        
        assert_eq!(links[0].target, LinkTarget::Title("Test Document".to_string()));
        assert_eq!(links[0].link_type, LinkType::Reference);
        assert_eq!(links[0].link_text, None);
        
        assert_eq!(links[1].target, LinkTarget::Title("Another Document".to_string()));
        assert_eq!(links[1].link_type, LinkType::Reference);
        assert_eq!(links[1].link_text, Some("custom text".to_string()));
    }

    #[test]
    fn test_parse_uuid_links() {
        let uuid = Uuid::new_v4();
        let content = format!("Link to [[{}]]", uuid);
        let links = LinkParser::parse_links(&content);
        
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, LinkTarget::Id(uuid));
    }

    #[test]
    fn test_parse_embed_links() {
        let content = "Embed this ![[Embedded Document]] here.";
        let links = LinkParser::parse_links(content);
        
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, LinkTarget::Title("Embedded Document".to_string()));
        assert_eq!(links[0].link_type, LinkType::Embed);
    }

    #[test]
    fn test_parse_mention_links() {
        let content = "Mention @[[John Doe]] in this document.";
        let links = LinkParser::parse_links(content);
        
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, LinkTarget::Title("John Doe".to_string()));
        assert_eq!(links[0].link_type, LinkType::Mention);
    }

    #[test]
    fn test_update_link_targets() {
        let content = "Link to [[Old Title]] and [[Keep This]].";
        let updated = LinkParser::update_link_targets(content, |target| {
            match target {
                LinkTarget::Title(title) if title == "Old Title" => Some("New Title".to_string()),
                _ => None,
            }
        });
        
        assert_eq!(updated, "Link to [[New Title]] and [[Keep This]].");
    }
}