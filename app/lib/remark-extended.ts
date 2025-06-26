import { createRemarkHtmlPlugin } from './remark-utils'

// Handle ==marked text==
export const remarkMark = createRemarkHtmlPlugin({
  pattern: /==([^=]+)==/g,
  tagName: 'mark',
  transformMatch: (match) => ({ content: match[1] })
})

// Handle {ruby base|ruby text}
export const remarkRuby = createRemarkHtmlPlugin({
  pattern: /\{([^|{}]+)\|([^|{}]+)\}/g,
  tagName: 'ruby',
  transformMatch: (match) => ({ 
    content: `${match[1]}<rt>${match[2]}</rt>` 
  })
})