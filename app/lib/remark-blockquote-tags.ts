import { visit } from 'unist-util-visit';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';

interface BlockquoteMetadata {
  name?: string;
  time?: string;
  color?: string;
}

export function remarkBlockquoteTags() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      if (node.children.length === 0) return;
      
      const firstChild = node.children[0];
      if (firstChild.type !== 'paragraph') return;
      
      const paragraph = firstChild as Paragraph;
      if (paragraph.children.length === 0) return;
      
      // Check if first child is text and contains tags
      const firstTextNode = paragraph.children[0];
      if (firstTextNode.type !== 'text') return;
      
      const text = (firstTextNode as Text).value;
      const tagRegex = /\[([^=]+)=([^\]]+)\]/g;
      const matches = [...text.matchAll(tagRegex)];
      
      if (matches.length === 0) return;
      
      const metadata: BlockquoteMetadata = {};
      let remainingText = text;
      
      // Extract metadata
      matches.forEach(match => {
        const [fullMatch, key, value] = match;
        if (key === 'name') metadata.name = value;
        else if (key === 'time') metadata.time = value;
        else if (key === 'color') metadata.color = value;
        remainingText = remainingText.replace(fullMatch, '');
      });
      
      // Update the text node
      (firstTextNode as Text).value = remainingText.trim();
      
      // Add metadata to blockquote
      const data = node.data || (node.data = {});
      data.hProperties = {
        ...(data.hProperties || {}),
        'data-name': metadata.name,
        'data-time': metadata.time,
        'data-color': metadata.color,
        style: metadata.color ? `border-left-color: ${metadata.color};` : undefined
      };
      
      // If we have metadata, add a header div
      if (metadata.name || metadata.time) {
        const headerHtml = `<div class="blockquote-header">${
          metadata.name ? `<span class="blockquote-name">${metadata.name}</span>` : ''
        }${
          metadata.time ? `<span class="blockquote-time">${metadata.time}</span>` : ''
        }</div>`;
        
        // Insert header as first child
        node.children.unshift({
          type: 'html',
          value: headerHtml
        } as import('mdast').Html);
      }
    });
  };
}