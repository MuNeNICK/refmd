use chrono::{DateTime, Utc};
use regex::Regex;
use std::collections::HashMap;
use uuid::Uuid;

use crate::entities::scrap::ScrapPost;
use crate::error::{Error, Result};

#[derive(Debug)]
pub struct ScrapContent {
    pub title: String,
    pub posts: Vec<ScrapPost>,
}

pub struct ScrapParser;

impl ScrapParser {
    pub fn parse_scrap_content(content: &str) -> Result<Vec<ScrapPost>> {
        let mut posts = Vec::new();
        
        // Regex to match scrap posts
        let post_regex = Regex::new(
            r#"<!-- scrap-post id="([^"]+)" author="([^"]+)" created_at="([^"]+)" -->\n([\s\S]*?)<!-- /scrap-post -->"#
        ).map_err(|e| Error::InternalServerError(format!("Regex error: {}", e)))?;
        
        for capture in post_regex.captures_iter(content) {
            let id = Uuid::parse_str(&capture[1])
                .map_err(|e| Error::InternalServerError(format!("Invalid UUID: {}", e)))?;
            let author_id = Uuid::parse_str(&capture[2])
                .map_err(|e| Error::InternalServerError(format!("Invalid author UUID: {}", e)))?;
            let created_at = DateTime::parse_from_rfc3339(&capture[3])
                .map_err(|e| Error::InternalServerError(format!("Invalid datetime: {}", e)))?
                .with_timezone(&Utc);
            let post_content = capture[4].trim().to_string();
            
            posts.push(ScrapPost {
                id,
                author_id,
                author_name: None,
                content: post_content,
                created_at,
                updated_at: created_at, // Will be updated separately if needed
            });
        }
        
        Ok(posts)
    }
    
    pub fn generate_scrap_content(
        title: &str,
        posts: &[ScrapPost],
        metadata: &HashMap<String, String>,
    ) -> String {
        let mut content = String::new();
        
        // Add frontmatter
        content.push_str("---\n");
        for (key, value) in metadata {
            content.push_str(&format!("{}: {}\n", key, value));
        }
        content.push_str("---\n\n");
        
        // Add title
        content.push_str(&format!("# {}\n\n", title));
        
        // Add posts
        for post in posts {
            content.push_str(&format!(
                "<!-- scrap-post id=\"{}\" author=\"{}\" created_at=\"{}\" -->\n{}\n<!-- /scrap-post -->\n\n",
                post.id,
                post.author_id,
                post.created_at.to_rfc3339(),
                post.content
            ));
        }
        
        content
    }
    
    pub fn add_post_to_content(
        content: &str,
        new_post: &ScrapPost,
    ) -> Result<String> {
        // Find the end of the content (before any trailing newlines)
        let trimmed_content = content.trim_end();
        
        // Add the new post
        let post_html = format!(
            "\n\n<!-- scrap-post id=\"{}\" author=\"{}\" created_at=\"{}\" -->\n{}\n<!-- /scrap-post -->",
            new_post.id,
            new_post.author_id,
            new_post.created_at.to_rfc3339(),
            new_post.content
        );
        
        Ok(format!("{}{}\n", trimmed_content, post_html))
    }
    
    pub fn update_post_in_content(
        content: &str,
        post_id: Uuid,
        new_content: &str,
    ) -> Result<String> {
        let post_regex = Regex::new(
            &format!(
                r#"(<!-- scrap-post id="{}" author="[^"]+" created_at="[^"]+" -->)\n[\s\S]*?(<!-- /scrap-post -->)"#,
                post_id
            )
        ).map_err(|e| Error::InternalServerError(format!("Regex error: {}", e)))?;
        
        if !post_regex.is_match(content) {
            return Err(Error::NotFound("Post not found".to_string()));
        }
        
        let replacement = format!("$1\n{}\n$2", new_content);
        let result = post_regex.replace(content, replacement.as_str());
        
        Ok(result.to_string())
    }
    
    pub fn delete_post_from_content(
        content: &str,
        post_id: Uuid,
    ) -> Result<String> {
        let post_regex = Regex::new(
            &format!(
                r#"<!-- scrap-post id="{}" author="[^"]+" created_at="[^"]+" -->\n[\s\S]*?<!-- /scrap-post -->\n*"#,
                post_id
            )
        ).map_err(|e| Error::InternalServerError(format!("Regex error: {}", e)))?;
        
        if !post_regex.is_match(content) {
            return Err(Error::NotFound("Post not found".to_string()));
        }
        
        let result = post_regex.replace(content, "");
        Ok(result.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_scrap_content() {
        let content = r#"---
id: 123e4567-e89b-12d3-a456-426614174000
title: Test Scrap
type: scrap
---

# Test Scrap

<!-- scrap-post id="550e8400-e29b-41d4-a716-446655440000" author="550e8400-e29b-41d4-a716-446655440001" created_at="2024-01-15T10:30:00Z" -->
This is the first post.
<!-- /scrap-post -->

<!-- scrap-post id="550e8400-e29b-41d4-a716-446655440002" author="550e8400-e29b-41d4-a716-446655440001" created_at="2024-01-15T11:30:00Z" -->
This is the second post.
<!-- /scrap-post -->
"#;
        
        let posts = ScrapParser::parse_scrap_content(content).unwrap();
        assert_eq!(posts.len(), 2);
        assert_eq!(posts[0].content, "This is the first post.");
        assert_eq!(posts[1].content, "This is the second post.");
    }
    
    #[test]
    fn test_generate_scrap_content() {
        let mut metadata = HashMap::new();
        metadata.insert("id".to_string(), "123e4567-e89b-12d3-a456-426614174000".to_string());
        metadata.insert("type".to_string(), "scrap".to_string());
        
        let posts = vec![
            ScrapPost {
                id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
                author_id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440001").unwrap(),
                author_name: None,
                content: "First post".to_string(),
                created_at: DateTime::parse_from_rfc3339("2024-01-15T10:30:00Z").unwrap().with_timezone(&Utc),
                updated_at: DateTime::parse_from_rfc3339("2024-01-15T10:30:00Z").unwrap().with_timezone(&Utc),
            }
        ];
        
        let content = ScrapParser::generate_scrap_content("Test Scrap", &posts, &metadata);
        assert!(content.contains("# Test Scrap"));
        assert!(content.contains("First post"));
        assert!(content.contains("<!-- scrap-post"));
    }
}