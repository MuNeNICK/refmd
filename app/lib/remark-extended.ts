import { visit } from 'unist-util-visit';
import type { Root, Text } from 'mdast';

// Handle ==marked text==
export function remarkMark() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return;
      
      const regex = /==([^=]+)==/g;
      const matches = [...node.value.matchAll(regex)];
      
      if (matches.length === 0) return;
      
      const newNodes: import('mdast').Node[] = [];
      let lastIndex = 0;
      
      matches.forEach(match => {
        const startIndex = match.index!;
        
        // Add text before the match
        if (startIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: node.value.slice(lastIndex, startIndex)
          } as import('mdast').Text);
        }
        
        // Add marked text
        newNodes.push({
          type: 'html',
          value: `<mark>${match[1]}</mark>`
        } as import('mdast').Html);
        
        lastIndex = startIndex + match[0].length;
      });
      
      // Add remaining text
      if (lastIndex < node.value.length) {
        newNodes.push({
          type: 'text',
          value: node.value.slice(lastIndex)
        } as import('mdast').Text);
      }
      
      parent.children.splice(index, 1, ...(newNodes as import('mdast').PhrasingContent[]));
    });
  };
}

// Handle {ruby base|ruby text}
export function remarkRuby() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return;
      
      const regex = /\{([^|{}]+)\|([^|{}]+)\}/g;
      const matches = [...node.value.matchAll(regex)];
      
      if (matches.length === 0) return;
      
      const newNodes: import('mdast').Node[] = [];
      let lastIndex = 0;
      
      matches.forEach(match => {
        const startIndex = match.index!;
        
        // Add text before the match
        if (startIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: node.value.slice(lastIndex, startIndex)
          } as import('mdast').Text);
        }
        
        // Add ruby text
        newNodes.push({
          type: 'html',
          value: `<ruby>${match[1]}<rt>${match[2]}</rt></ruby>`
        } as import('mdast').Html);
        
        lastIndex = startIndex + match[0].length;
      });
      
      // Add remaining text
      if (lastIndex < node.value.length) {
        newNodes.push({
          type: 'text',
          value: node.value.slice(lastIndex)
        } as import('mdast').Text);
      }
      
      parent.children.splice(index, 1, ...(newNodes as import('mdast').PhrasingContent[]));
    });
  };
}