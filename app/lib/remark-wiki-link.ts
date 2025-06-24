/* eslint-disable @typescript-eslint/no-explicit-any */
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Root, Text, Link } from 'mdast'

interface WikiLinkNode {
  type: 'wikiLink'
  value: string
  data: {
    alias?: string
    target: string
  }
}

// Extend mdast types to include wikiLink
declare module 'mdast' {
  interface PhrasingContentMap {
    wikiLink: WikiLinkNode
  }
}

/**
 * Remark plugin to parse wiki-style links [[Document Title]] or [[Document Title|Display Text]]
 * and convert them into standard markdown links
 */
export const remarkWikiLink: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === null) return

      const value = node.value
      // Match [[Document Title]] or [[Document Title|Display Text]] or [[id:UUID|Display Text]]
      // Updated regex to handle pipe character correctly
      const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
      
      const matches = Array.from(value.matchAll(wikiLinkRegex))
      if (matches.length === 0) return

      const nodes: (Text | Link)[] = []
      let lastIndex = 0

      for (const match of matches) {
        const [fullMatch, content] = match
        const startIndex = match.index!
        
        // Split by pipe to separate target and alias
        const parts = content.split('|')
        const target = parts[0].trim()
        const alias = parts[1]?.trim()
        
        // Check if this should be rendered inline
        const isInlineDisplay = alias === 'inline'

        // Add text before the match
        if (startIndex > lastIndex) {
          nodes.push({
            type: 'text',
            value: value.slice(lastIndex, startIndex)
          })
        }

        // Create a link node
        const linkNode: Link = {
          type: 'link',
          url: `#wiki:${encodeURIComponent(target)}`, // Encode target in URL
          title: target,
          children: [{
            type: 'text',
            value: isInlineDisplay ? `${target}|inline` : (alias || target)
          }],
          data: {
            hProperties: {
              className: 'wiki-link',
              'data-wiki-target': target
            }
          }
        }

        nodes.push(linkNode)
        lastIndex = startIndex + fullMatch.length
      }

      // Add remaining text
      if (lastIndex < value.length) {
        nodes.push({
          type: 'text',
          value: value.slice(lastIndex)
        })
      }

      // Replace the original text node with our new nodes
      if (index !== undefined) {
        parent.children.splice(index, 1, ...nodes)
      }
    })
  }
}

/**
 * Remark plugin to handle embed links ![[Document Title]]
 */
export const remarkEmbedLink: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === null) return

      const value = node.value
      // Match ![[Document Title]]
      const embedLinkRegex = /!\[\[([^\]]+)\]\]/g
      
      const matches = Array.from(value.matchAll(embedLinkRegex))
      if (matches.length === 0) return

      const nodes: any[] = []
      let lastIndex = 0

      for (const match of matches) {
        const [fullMatch, target] = match
        const startIndex = match.index!

        // Add text before the match
        if (startIndex > lastIndex) {
          nodes.push({
            type: 'text',
            value: value.slice(lastIndex, startIndex)
          })
        }

        // Create an embed node (rendered as a div with special class)
        const embedNode: any = {
          type: 'paragraph',
          data: {
            hName: 'div',
            hProperties: {
              className: 'document-embed',
              'data-embed-target': target.trim()
            }
          },
          children: [{
            type: 'text',
            value: `[Embedded: ${target.trim()}]`
          }]
        }

        nodes.push(embedNode)
        lastIndex = startIndex + fullMatch.length
      }

      // Add remaining text
      if (lastIndex < value.length) {
        nodes.push({
          type: 'text',
          value: value.slice(lastIndex)
        })
      }

      // Replace the original text node with our new nodes
      if (index !== undefined) {
        parent.children.splice(index, 1, ...nodes)
      }
    })
  }
}

/**
 * Remark plugin to handle mention links @[[Document Title]]
 */
export const remarkMentionLink: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === null) return

      const value = node.value
      // Match @[[Document Title]]
      const mentionLinkRegex = /@\[\[([^\]]+)\]\]/g
      
      const matches = Array.from(value.matchAll(mentionLinkRegex))
      if (matches.length === 0) return

      const nodes: (Text | Link)[] = []
      let lastIndex = 0

      for (const match of matches) {
        const [fullMatch, target] = match
        const startIndex = match.index!

        // Add text before the match
        if (startIndex > lastIndex) {
          nodes.push({
            type: 'text',
            value: value.slice(lastIndex, startIndex)
          })
        }

        // Create a mention link node
        const linkNode: Link = {
          type: 'link',
          url: `#mention:${encodeURIComponent(target.trim())}`, // Encode target in URL
          title: target.trim(),
          children: [{
            type: 'text',
            value: `@${target.trim()}`
          }],
          data: {
            hProperties: {
              className: 'mention-link',
              'data-mention-target': target.trim()
            }
          }
        }

        nodes.push(linkNode)
        lastIndex = startIndex + fullMatch.length
      }

      // Add remaining text
      if (lastIndex < value.length) {
        nodes.push({
          type: 'text',
          value: value.slice(lastIndex)
        })
      }

      // Replace the original text node with our new nodes
      if (index !== undefined) {
        parent.children.splice(index, 1, ...nodes)
      }
    })
  }
}