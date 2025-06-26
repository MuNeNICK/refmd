interface ScrapPostMetadata {
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string; // User ID
}

export class ScrapMetadataParser {
  // Support both old format (with :userName) and new format (userId only)
  // Made the newline optional to handle both cases
  // Updated regex to use non-greedy match for pinnedAt to handle colons in ISO date
  private static readonly METADATA_REGEX = /<!-- metadata:pinned=true:pinnedAt=(.+?):pinnedBy=(.+?) -->\r?\n?/;
  
  private static getMetadataRegex(): RegExp {
    // Return a new instance each time to avoid regex state issues
    return /<!-- metadata:pinned=true:pinnedAt=(.+?):pinnedBy=(.+?) -->\r?\n?/g;
  }

  static parseMetadata(content: string): { content: string; metadata: ScrapPostMetadata } {
    const match = content.match(this.METADATA_REGEX);
    
    if (!match) {
      return { content, metadata: {} };
    }

    // Extract userId from pinnedBy (handle both old "userId:userName" and new "userId" formats)
    const pinnedByValue = match[2];
    const userId = pinnedByValue.includes(':') ? pinnedByValue.split(':')[0] : pinnedByValue;
    
    const metadata: ScrapPostMetadata = {
      isPinned: true,
      pinnedAt: match[1],
      pinnedBy: userId
    };

    // Remove metadata from content
    const cleanContent = content.replace(this.METADATA_REGEX, '');

    return { content: cleanContent, metadata };
  }

  static addPinMetadata(content: string, userId: string): string {
    // First, completely remove any existing metadata
    let cleanContent = content;
    
    // Remove all metadata tags (handle multiple occurrences)
    let regex = this.getMetadataRegex();
    while (regex.test(cleanContent)) {
      cleanContent = cleanContent.replace(regex, '');
      regex = this.getMetadataRegex(); // Get fresh regex instance
    }
    
    const pinnedAt = new Date().toISOString();
    const metadata = `<!-- metadata:pinned=true:pinnedAt=${pinnedAt}:pinnedBy=${userId} -->\n`;
    
    return metadata + cleanContent;
  }

  static removePinMetadata(content: string): string {
    let cleanContent = content;
    
    // Remove all metadata tags (handle multiple occurrences)
    let regex = this.getMetadataRegex();
    while (regex.test(cleanContent)) {
      cleanContent = cleanContent.replace(regex, '');
      regex = this.getMetadataRegex(); // Get fresh regex instance
    }
    
    return cleanContent;
  }

  static isPinned(content: string): boolean {
    const { metadata } = this.parseMetadata(content);
    return metadata.isPinned || false;
  }
}