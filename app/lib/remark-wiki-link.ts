import type { Plugin } from 'unified'
import type { Root } from 'mdast'
import { createRemarkPatternPlugin } from './remark-utils'

/**
 * Remark plugin to parse wiki-style links [[Document Title]] or [[Document Title|Display Text]]
 * and convert them into standard markdown links
 */
export const remarkWikiLink: Plugin<[], Root> = createRemarkPatternPlugin({
  pattern: /\[\[([^\]]+)\]\]/g,
  nodeType: 'link',
  extractData: (match) => {
    const content = match[1]
    const parts = content.split('|')
    const target = parts[0].trim()
    const alias = parts[1]?.trim()
    const isInlineDisplay = alias === 'inline'

    return {
      url: `#wiki:${encodeURIComponent(target)}`,
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
  }
})

/**
 * Remark plugin to handle embed links ![[Document Title]]
 */
export const remarkEmbedLink: Plugin<[], Root> = createRemarkPatternPlugin({
  pattern: /!\[\[([^\]]+)\]\]/g,
  nodeType: 'paragraph',
  extractData: (match) => {
    const target = match[1].trim()
    
    return {
      data: {
        hName: 'div',
        hProperties: {
          className: 'document-embed',
          'data-embed-target': target
        }
      },
      children: [{
        type: 'text',
        value: `[Embedded: ${target}]`
      }]
    }
  }
})

/**
 * Remark plugin to handle mention links @[[Document Title]]
 */
export const remarkMentionLink: Plugin<[], Root> = createRemarkPatternPlugin({
  pattern: /@\[\[([^\]]+)\]\]/g,
  nodeType: 'link',
  extractData: (match) => {
    const target = match[1].trim()
    
    return {
      url: `#mention:${encodeURIComponent(target)}`,
      title: target,
      children: [{
        type: 'text',
        value: `@${target}`
      }],
      data: {
        hProperties: {
          className: 'mention-link',
          'data-mention-target': target
        }
      }
    }
  }
})