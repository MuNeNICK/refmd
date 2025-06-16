import { visit } from 'unist-util-visit';
import type { Root, Node } from 'mdast';

const alertTypes = {
  success: { icon: 'check-circle', className: 'alert-success' },
  info: { icon: 'info-circle', className: 'alert-info' },
  warning: { icon: 'exclamation-triangle', className: 'alert-warning' },
  danger: { icon: 'exclamation-circle', className: 'alert-danger' },
  spoiler: { icon: 'eye-slash', className: 'alert-spoiler' }
};

export function remarkAlert() {
  return (tree: Root) => {
    visit(tree, 'containerDirective', (node: Node & { name: string; children: Node[] }) => {
      const type = node.name as keyof typeof alertTypes;
      
      if (type in alertTypes) {
        const alert = alertTypes[type];
        const data = node.data || (node.data = {});
        const tagName = 'div';
        
        data.hName = tagName;
        data.hProperties = {
          class: `alert ${alert.className}`,
          'data-alert-type': type
        };

        // Add icon and content wrapper
        node.children = [
          {
            type: 'paragraph',
            data: {
              hName: 'div',
              hProperties: { class: 'alert-icon' }
            },
            children: [
              {
                type: 'html',
                value: `<i class="fas fa-${alert.icon}"></i>`
              } as import('mdast').Html
            ]
          } as import('mdast').Paragraph,
          {
            type: 'paragraph',
            data: {
              hName: 'div',
              hProperties: { class: 'alert-content' }
            },
            children: node.children
          } as import('mdast').Paragraph
        ];

        // Special handling for spoiler
        if (type === 'spoiler') {
          const contentNode = node.children[1] as import('mdast').Paragraph;
          const firstChild = contentNode.children[0] as import('mdast').Text | undefined;
          const title = firstChild?.value || 'Click to reveal';
          if (contentNode.data?.hProperties) {
            (contentNode.data.hProperties as Record<string, unknown>)['data-spoiler-title'] = title;
          }
        }
      }
    });
  };
}