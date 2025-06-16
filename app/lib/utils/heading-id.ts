export function generateHeadingId(text: string): string {
  if (!text) return "";
  
  // Create a slug from the heading text
  // Keep Unicode characters (including Japanese) but remove special punctuation
  let id = text
    .toLowerCase()
    .replace(/[<>:"\/\\|?*]/g, "") // Remove file-system unsafe characters
    .replace(/[\s\u3000]+/g, "-") // Replace spaces (including full-width space) with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .trim();

  // Handle empty id
  if (!id) {
    id = "heading";
  }

  // For now, just return the basic id without duplicate handling
  // Duplicate handling would need to be managed at a higher level
  return id;
}