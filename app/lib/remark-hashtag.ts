import { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { Text, Parent, Link } from 'mdast';

interface Options {
  className?: string;
}

const remarkHashtag: Plugin<[Options?]> = (options = {}) => {
  const { className = 'hashtag' } = options;

  return (tree) => {
    visit(tree, 'text', (node: Text, index: number | null, parent: Parent | null) => {
      if (!parent || index === null) return;

      const value = node.value;
      // Match hashtags that:
      // - Start with # at word boundary
      // - Followed by alphanumeric characters (including Unicode)
      // - Can contain hyphens or underscores in the middle
      const regex = /\B#([a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\uAC00-\uD7AF_-]+)(?=\s|$)/g;
      
      const nodes: (Text | Link)[] = [];
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

        // Create a link node for the hashtag
        const linkNode: Link = {
          type: 'link',
          url: `#tag-${encodeURIComponent(tagName)}`, // Use unique URL to help with identification
          title: null,
          children: [{
            type: 'text',
            value: fullMatch,
          }],
          data: {
            hProperties: {
              className: className,
              'data-tag': tagName,
              dataTag: tagName, // Also add camelCase version
            },
          },
        };
        
        nodes.push(linkNode);
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
      if (nodes.length > 0) {
        parent.children.splice(index, 1, ...nodes);
        return index + nodes.length; // Skip the newly inserted nodes
      }
    });
  };
};

export default remarkHashtag;