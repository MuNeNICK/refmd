import { visit } from 'unist-util-visit';
import type { Root, Paragraph, Text } from 'mdast';

interface EmbedPattern {
  pattern: RegExp;
  replace: (match: RegExpMatchArray) => string;
}

const embedPatterns: EmbedPattern[] = [
  // YouTube
  {
    pattern: /^\{%youtube\s+([a-zA-Z0-9_-]+)\s*%\}$/,
    replace: (match) => `<div class="embed-responsive"><iframe src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen></iframe></div>`
  },
  // Vimeo
  {
    pattern: /^\{%vimeo\s+(\d+)\s*%\}$/,
    replace: (match) => `<div class="embed-responsive"><iframe src="https://player.vimeo.com/video/${match[1]}" frameborder="0" allowfullscreen></iframe></div>`
  },
  // Gist
  {
    pattern: /^\{%gist\s+([a-zA-Z0-9]+\/[a-zA-Z0-9]+)\s*%\}$/,
    replace: (match) => `<script src="https://gist.github.com/${match[1]}.js"></script>`
  },
  // SlideShare
  {
    pattern: /^\{%slideshare\s+([a-zA-Z0-9\/-]+)\s*%\}$/,
    replace: (match) => {
      const id = match[1].split('/').pop() || match[1];
      return `<div class="embed-responsive"><iframe src="https://www.slideshare.net/slideshow/embed_code/key/${id}" frameborder="0" allowfullscreen></iframe></div>`;
    }
  },
  // PDF
  {
    pattern: /^\{%pdf\s+(.+?)\s*%\}$/,
    replace: (match) => `<div class="embed-responsive"><iframe src="${match[1]}" frameborder="0"></iframe></div>`
  }
];

export function remarkEmbed() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      if (node.children.length === 1 && node.children[0].type === 'text') {
        const textNode = node.children[0] as Text;
        const text = textNode.value.trim();
        
        for (const embed of embedPatterns) {
          const match = text.match(embed.pattern);
          if (match) {
            const html = embed.replace(match);
            // Replace the paragraph with HTML node
            if (parent && typeof index === 'number') {
              parent.children[index] = {
                type: 'html',
                value: html
              } as import('mdast').Html;
            }
            break;
          }
        }
      }
    });
  };
}