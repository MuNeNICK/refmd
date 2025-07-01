use regex::Regex;
use std::collections::HashSet;

pub struct TagParser {
    tag_regex: Regex,
}

impl TagParser {
    pub fn new() -> Self {
        // Match hashtags that:
        // - Start with # at word boundary
        // - Followed by alphanumeric characters (including Unicode)
        // - Can contain hyphens or underscores in the middle
        // - Must not end with punctuation
        let tag_regex = Regex::new(r"\B#([a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\uAC00-\uD7AF_-]+)(?:\b|$)").unwrap();
        
        Self { tag_regex }
    }

    /// Extract all hashtags from the given content
    pub fn extract_tags(&self, content: &str) -> Vec<String> {
        let mut tags = HashSet::new();
        
        for capture in self.tag_regex.captures_iter(content) {
            if let Some(tag) = capture.get(1) {
                let tag_text = tag.as_str().to_lowercase();
                // Skip tags that are too short or too long
                if tag_text.len() >= 2 && tag_text.len() <= 50 {
                    tags.insert(tag_text);
                }
            }
        }
        
        let mut result: Vec<String> = tags.into_iter().collect();
        result.sort();
        result
    }

    /// Check if a string is a valid tag name
    pub fn is_valid_tag(tag: &str) -> bool {
        if tag.is_empty() || tag.len() > 50 {
            return false;
        }
        
        // Tag should only contain alphanumeric characters, hyphens, and underscores
        tag.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    }

    /// Normalize a tag name (lowercase, trim)
    pub fn normalize_tag(tag: &str) -> String {
        tag.trim().to_lowercase()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_tags() {
        let parser = TagParser::new();
        
        // Test basic tags
        let content = "This is a #test post with #multiple #tags";
        let tags = parser.extract_tags(content);
        assert_eq!(tags, vec!["multiple", "tags", "test"]);
        
        // Test Japanese tags
        let content = "これは #テスト の投稿です #日本語タグ";
        let tags = parser.extract_tags(content);
        assert_eq!(tags, vec!["テスト", "日本語タグ"]);
        
        // Test mixed content
        let content = "#tag1 some text #tag-with-hyphen #tag_with_underscore #123numeric";
        let tags = parser.extract_tags(content);
        assert_eq!(tags, vec!["123numeric", "tag-with-hyphen", "tag1", "tag_with_underscore"]);
        
        // Test invalid tags (too short)
        let content = "#a #ab #abc";
        let tags = parser.extract_tags(content);
        assert_eq!(tags, vec!["ab", "abc"]); // "a" is filtered out
        
        // Test tags at end of sentences
        let content = "End with a tag #endtag. New sentence #newtag!";
        let tags = parser.extract_tags(content);
        assert_eq!(tags, vec!["endtag", "newtag"]);
    }

    #[test]
    fn test_is_valid_tag() {
        assert!(TagParser::is_valid_tag("test"));
        assert!(TagParser::is_valid_tag("test123"));
        assert!(TagParser::is_valid_tag("test-tag"));
        assert!(TagParser::is_valid_tag("test_tag"));
        assert!(TagParser::is_valid_tag("テスト"));
        
        assert!(!TagParser::is_valid_tag(""));
        assert!(!TagParser::is_valid_tag("test tag")); // spaces not allowed
        assert!(!TagParser::is_valid_tag("test@tag")); // special chars not allowed
        assert!(!TagParser::is_valid_tag(&"a".repeat(51))); // too long
    }

    #[test]
    fn test_normalize_tag() {
        assert_eq!(TagParser::normalize_tag("Test"), "test");
        assert_eq!(TagParser::normalize_tag(" TAG "), "tag");
        assert_eq!(TagParser::normalize_tag("MixedCase"), "mixedcase");
    }
}