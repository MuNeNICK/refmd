import { visit } from 'unist-util-visit'
import type { Root, Text, PhrasingContent, RootContent } from 'mdast'
import type { Plugin } from 'unified'

interface PatternConfig {
  pattern: RegExp
  nodeType: string
  extractData: (match: RegExpMatchArray) => Record<string, unknown>
}

export function createRemarkPatternPlugin(config: PatternConfig): Plugin<[], Root> {
  return function () {
    return function (tree: Root) {
      visit(tree, 'text', (node: Text, index, parent) => {
        if (!parent || index === undefined) return

        const value = node.value
        const pattern = config.pattern
        const children: (Text | PhrasingContent | RootContent)[] = []
        let lastIndex = 0
        let match

        while ((match = pattern.exec(value)) !== null) {
          if (match.index > lastIndex) {
            children.push({
              type: 'text',
              value: value.slice(lastIndex, match.index)
            })
          }

          const data = config.extractData(match)
          children.push({
            type: config.nodeType,
            data,
            children: [{ type: 'text', value: match[0] }]
          } as PhrasingContent)

          lastIndex = pattern.lastIndex
        }

        if (lastIndex < value.length) {
          children.push({
            type: 'text',
            value: value.slice(lastIndex)
          })
        }

        if (children.length > 0) {
          parent.children.splice(index, 1, ...children)
        }
      })
    }
  }
}

interface HtmlTransformConfig {
  pattern: RegExp
  tagName: string
  transformMatch: (match: RegExpMatchArray) => { content: string; attributes?: Record<string, string> }
}

export function createRemarkHtmlPlugin(config: HtmlTransformConfig): Plugin<[], Root> {
  return function () {
    return function (tree: Root) {
      visit(tree, 'text', (node: Text, index, parent) => {
        if (!parent || index === undefined) return

        const value = node.value
        const pattern = config.pattern
        const children: (Text | PhrasingContent | RootContent)[] = []
        let lastIndex = 0
        let match

        while ((match = pattern.exec(value)) !== null) {
          if (match.index > lastIndex) {
            children.push({
              type: 'text',
              value: value.slice(lastIndex, match.index)
            })
          }

          const { content, attributes = {} } = config.transformMatch(match)
          const htmlAttributes = Object.entries(attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ')
          
          const openTag = htmlAttributes 
            ? `<${config.tagName} ${htmlAttributes}>`
            : `<${config.tagName}>`
          
          children.push({
            type: 'html',
            value: `${openTag}${content}</${config.tagName}>`
          })

          lastIndex = pattern.lastIndex
        }

        if (lastIndex < value.length) {
          children.push({
            type: 'text',
            value: value.slice(lastIndex)
          })
        }

        if (children.length > 0) {
          parent.children.splice(index, 1, ...children)
        }
      })
    }
  }
}