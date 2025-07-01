import { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { Text, Parent } from 'mdast';

export interface HashtagNode {
  type: 'hashtag';
  value: string;
  data?: {
    hName?: string;
    hProperties?: {
      className?: string[];
      href?: string;
      'data-tag'?: string;
    };
  };
}

interface Options {
  className?: string;
  linkPrefix?: string;
}

const remarkHashtag: Plugin<[Options?]> = (options = {}) => {
  const { className = 'hashtag', linkPrefix = '#tag:' } = options;

  return (tree) => {
    visit(tree, 'text', (node: Text, index: number | null, parent: Parent | null) => {
      if (!parent || index === null) return;

      const value = node.value;
      // Match hashtags that:
      // - Start with # at word boundary
      // - Followed by alphanumeric characters (including Unicode)
      // - Can contain hyphens or underscores in the middle
      const regex = /\B#([a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\uAC00-\uD7AF_-]+)(?:\b|$)/g;
      
      const nodes: (Text | HashtagNode)[] = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(value)) !== null) {
        const [fullMatch, tagName] = match;
        const startIndex = match.index;

        // Add text before the hashtag
        if (startIndex > lastIndex) {
          nodes.push({
            type: 'text',
            value: value.slice(lastIndex, startIndex),
          });
        }

        // Add the hashtag node
        const hashtagNode: HashtagNode = {
          type: 'hashtag',
          value: fullMatch,
          data: {
            hName: 'a',
            hProperties: {
              className: [className],
              href: `${linkPrefix}${encodeURIComponent(tagName)}`,
              'data-tag': tagName,
            },
          },
        };
        
        nodes.push(hashtagNode);
        lastIndex = startIndex + fullMatch.length;
      }

      // Add remaining text
      if (lastIndex < value.length) {
        nodes.push({
          type: 'text',
          value: value.slice(lastIndex),
        });
      }

      // Replace the original text node with the new nodes
      if (nodes.length > 1) {
        parent.children.splice(index, 1, ...nodes);
      }
    });
  };
};

export default remarkHashtag;