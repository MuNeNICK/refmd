export interface ScrapComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export class ScrapCommentParser {
  private static readonly COMMENT_START_REGEX = /<!-- comment:start:id=([^:]+):author=([^:]+):authorName=([^:]+):date=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)(?::updated=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z))?\s*-->/g;
  private static readonly COMMENT_END = '<!-- comment:end -->';

  static parseComments(markdown: string): { content: string; comments: ScrapComment[] } {
    const comments: ScrapComment[] = [];
    let match;

    // Reset the regex index
    this.COMMENT_START_REGEX.lastIndex = 0;

    while ((match = this.COMMENT_START_REGEX.exec(markdown)) !== null) {
      
      const startIndex = match.index;
      const endIndex = markdown.indexOf(this.COMMENT_END, startIndex);
      
      if (endIndex === -1) continue;

      const id = match[1];
      const authorId = match[2];
      const authorName = decodeURIComponent(match[3]);
      const createdAt = match[4];
      const updatedAt = match[5];
      
      // Validate date format
      if (!createdAt || createdAt === 'undefined') {
        continue;
      }
      
      const commentContent = markdown.substring(
        startIndex + match[0].length,
        endIndex
      );

      comments.push({
        id,
        authorId,
        authorName,
        content: commentContent,
        createdAt,
        updatedAt,
      });
    }

    // Use existing method to extract content without comments
    const contentWithoutComments = this.extractContentWithoutComments(markdown);

    return { content: contentWithoutComments, comments };
  }

  static addComment(
    markdown: string,
    comment: Omit<ScrapComment, 'id' | 'createdAt'>,
    existingId?: string,
    existingDate?: string
  ): string {
    // Use existing ID and date if provided (for preserving comments during edit)
    const id = existingId || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    const createdAt = existingDate || new Date().toISOString();
    const authorNameEncoded = encodeURIComponent(comment.authorName);
    
    // Include updatedAt if we have an existing date (meaning this is a preserved comment)
    const updatedPart = existingDate && comment.updatedAt ? `:updated=${comment.updatedAt}` : '';

    const commentMarkup = `\n\n<!-- comment:start:id=${id}:author=${comment.authorId}:authorName=${authorNameEncoded}:date=${createdAt}${updatedPart} -->
${comment.content}
<!-- comment:end -->`;

    return markdown + commentMarkup;
  }

  static updateComment(
    markdown: string,
    commentId: string,
    newContent: string
  ): string {
    const regex = new RegExp(
      `(<!-- comment:start:id=${commentId}[^>]*)( -->)([\\s\\S]*?)(<!-- comment:end -->)`,
      'g'
    );

    return markdown.replace(regex, (_, start, end, _oldContent, endTag) => {
      const updatedAt = new Date().toISOString();
      const updatedStart = start.includes(':updated=')
        ? start.replace(/:updated=[^\s>]+/, `:updated=${updatedAt}`)
        : `${start}:updated=${updatedAt}`;
      
      return `${updatedStart}${end}
${newContent}
${endTag}`;
    });
  }

  static deleteComment(markdown: string, commentId: string): string {
    const regex = new RegExp(
      `\\n*<!-- comment:start:id=${commentId}[^>]*>[\\s\\S]*?<!-- comment:end -->\\n*`,
      'g'
    );

    return markdown.replace(regex, '');
  }

  static extractContentWithoutComments(markdown: string): string {
    const regex = /\n*<!-- comment:start:[^>]*>[\s\S]*?<!-- comment:end -->\n*/g;
    return markdown.replace(regex, '').trim();
  }
}