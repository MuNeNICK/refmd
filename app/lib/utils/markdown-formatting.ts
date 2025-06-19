export interface FormatResult {
  formattedText: string;
  cursorOffset: number;
}

export function applyMarkdownFormat(
  format: string,
  selectedText: string
): FormatResult | null {
  let formattedText = '';
  let cursorOffset = 0;
  
  switch (format) {
    case 'bold':
      formattedText = `**${selectedText || 'bold text'}**`;
      cursorOffset = selectedText ? formattedText.length : 2;
      break;
    case 'italic':
      formattedText = `*${selectedText || 'italic text'}*`;
      cursorOffset = selectedText ? formattedText.length : 1;
      break;
    case 'heading':
      formattedText = `# ${selectedText || 'Heading'}`;
      cursorOffset = selectedText ? formattedText.length : 2;
      break;
    case 'list':
      formattedText = `- ${selectedText || 'List item'}`;
      cursorOffset = selectedText ? formattedText.length : 2;
      break;
    case 'link':
      formattedText = selectedText ? `[${selectedText}](url)` : '[link text](url)';
      cursorOffset = selectedText ? formattedText.length - 4 : 1;
      break;
    case 'code':
      if (selectedText.includes('\n')) {
        formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
        cursorOffset = 4;
      } else {
        formattedText = `\`${selectedText || 'code'}\``;
        cursorOffset = selectedText ? formattedText.length : 1;
      }
      break;
    case 'quote':
      formattedText = `> ${selectedText || 'Quote'}`;
      cursorOffset = selectedText ? formattedText.length : 2;
      break;
    default:
      return null;
  }
  
  return { formattedText, cursorOffset };
}