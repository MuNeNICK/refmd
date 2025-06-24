import type { editor, languages, CancellationToken, Position } from 'monaco-editor';
import { getApiClient } from '@/lib/api';
import type { Document } from '@/lib/api/client/models/Document';

/* eslint-disable @typescript-eslint/no-unused-vars */

// Helper function to build document path
async function buildDocumentPath(doc: Document): Promise<string> {
  if (!doc || !doc.title) {
    return 'Unknown';
  }
  
  const api = getApiClient();
  const pathParts = [doc.title];
  let currentParentId = doc.parent_id;
  
  // Build path by traversing parent chain
  while (currentParentId) {
    try {
      const parentResponse = await api.documents.getDocument(currentParentId);
      const parent = parentResponse?.data || parentResponse;
      if (parent && parent.title) {
        pathParts.unshift(parent.title);
        currentParentId = parent.parent_id;
      } else {
        break;
      }
    } catch (error) {
      console.error('Failed to fetch parent document:', error);
      break;
    }
  }
  
  return pathParts.join(' / ');
}

// Check if there are duplicate titles
function findDuplicateTitles(documents: Document[]): Map<string, Document[]> {
  const titleMap = new Map<string, Document[]>();
  
  // Handle undefined or null documents
  if (!documents || !Array.isArray(documents)) {
    return new Map();
  }
  
  documents.forEach(doc => {
    if (doc && doc.title) {
      const lowerTitle = doc.title.toLowerCase();
      if (!titleMap.has(lowerTitle)) {
        titleMap.set(lowerTitle, []);
      }
      titleMap.get(lowerTitle)!.push(doc);
    }
  });
  
  // Filter out non-duplicates
  const duplicates = new Map<string, Document[]>();
  titleMap.forEach((docs, title) => {
    if (docs.length > 1) {
      duplicates.set(title, docs);
    }
  });
  
  return duplicates;
}

export class WikiLinkCompletionProvider implements languages.CompletionItemProvider {
  triggerCharacters = ['['];
  
  async provideCompletionItems(
    model: editor.ITextModel,
    position: Position,
    _context: languages.CompletionContext,
    _token: CancellationToken
  ): Promise<languages.CompletionList> {
    // Get the text before the cursor
    const textBeforeCursor = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    });
    
    // Get the text after the cursor to check for closing brackets
    const textAfterCursor = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: model.getLineMaxColumn(position.lineNumber)
    });
    
    // Check if we're in a wiki link context
    const wikiLinkMatch = textBeforeCursor.match(/(\[\[)([^\]]*?)$/);
    const embedLinkMatch = textBeforeCursor.match(/(!\[\[)([^\]]*?)$/);
    const mentionLinkMatch = textBeforeCursor.match(/(@\[\[)([^\]]*?)$/);
    
    const match = wikiLinkMatch || embedLinkMatch || mentionLinkMatch;
    if (!match) {
      return { suggestions: [] };
    }
    
    // const prefix = match[1]; // Prefix type is already handled in insertText
    const searchQuery = match[2];
    
    // Check if closing brackets already exist
    const hasClosingBrackets = textAfterCursor.startsWith(']]');
    
    try {
      // Search for documents
      const api = getApiClient();
      const response = await api.documents.searchDocuments(
        searchQuery || '',
        20 
      );
      const documents = Array.isArray(response) ? response : (response?.data || []);
      
      // Remove duplicates by ID
      const uniqueDocuments = documents.filter((doc, index, self) => 
        index === self.findIndex((d) => d.id === doc.id)
      );
      
      // Find duplicate titles
      const duplicateTitles = findDuplicateTitles(uniqueDocuments);
      
      // Create completion items
      const suggestions: languages.CompletionItem[] = await Promise.all(
        uniqueDocuments.map(async (doc: Document) => {
          const isDuplicate = duplicateTitles.has(doc.title.toLowerCase());
          const path = isDuplicate ? await buildDocumentPath(doc) : doc.title;
          
          // Always use ID-based link
          const insertText = hasClosingBrackets ? doc.id : `${doc.id}]]`;
          
          return {
            label: doc.title,
            kind: 17, // File
            detail: isDuplicate ? path : (doc.type === 'folder' ? 'Folder' : 'Document'),
            documentation: {
              value: `**${doc.title}**\n\n${
                isDuplicate ? `Path: ${path}\n\n` : ''
              }Type: ${doc.type}\nID: ${doc.id}\nCreated: ${doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Unknown'}`
            },
            insertText,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column - searchQuery.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            command: hasClosingBrackets ? {
              id: 'cursorMove',
              title: 'Move cursor',
              arguments: [{
                to: 'right',
                by: 'character',
                value: 2
              }]
            } : {
              id: 'editor.action.triggerSuggest',
              title: 'Re-trigger suggestions'
            }
          };
        })
      );
      
      // Add option to create a new document if there's a search query
      if (searchQuery && searchQuery.length > 0) {
        suggestions.unshift({
          label: `Create "${searchQuery}"`,
          kind: 25, // Constant
          detail: 'Create a new document',
          documentation: 'Create a new document with this title (link will use document ID)',
          insertText: hasClosingBrackets ? searchQuery : `${searchQuery}]]`, // This will be replaced with ID after creation
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column - searchQuery.length,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          }
        });
      }
      
      return { suggestions };
    } catch (error) {
      console.error('Failed to fetch document suggestions:', error);
      return { suggestions: [] };
    }
  }
}

// Hover provider for wiki links
export class WikiLinkHoverProvider implements languages.HoverProvider {
  async provideHover(
    model: editor.ITextModel,
    position: Position,
    _token: CancellationToken
  ): Promise<languages.Hover | null> {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    
    // Get the line text
    const lineText = model.getLineContent(position.lineNumber);
    
    // Check if we're hovering over a wiki link
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const embedLinkRegex = /!\[\[([^\]]+)\]\]/g;
    const mentionLinkRegex = /@\[\[([^\]]+)\]\]/g;
    
    // UUID regex pattern
    const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    const idLinkRegex = new RegExp(`\\[\\[(${uuidPattern})(?:\\|[^\\]]+)?\\]\\]`, 'gi');
    const embedIdLinkRegex = new RegExp(`!\\[\\[(${uuidPattern})(?:\\|[^\\]]+)?\\]\\]`, 'gi');
    const mentionIdLinkRegex = new RegExp(`@\\[\\[(${uuidPattern})(?:\\|[^\\]]+)?\\]\\]`, 'gi');
    
    let match;
    let linkTitle = null;
    let linkId = null;
    
    // Try to match ID-based links first
    for (const regex of [idLinkRegex, embedIdLinkRegex, mentionIdLinkRegex]) {
      regex.lastIndex = 0;
      while ((match = regex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        
        // Check if position is within the link
        if (position.column >= start + 1 && position.column <= end + 1) {
          linkId = match[1];
          break;
        }
      }
      if (linkId) break;
    }
    
    // If no ID link found, try title-based links
    if (!linkId) {
      for (const regex of [wikiLinkRegex, embedLinkRegex, mentionLinkRegex]) {
        regex.lastIndex = 0;
        while ((match = regex.exec(lineText)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          
          // Check if position is within the link
          if (position.column >= start + 1 && position.column <= end + 1) {
            linkTitle = match[1];
            break;
          }
        }
        if (linkTitle) break;
      }
    }
    
    if (!linkTitle && !linkId) return null;
    
    try {
      const api = getApiClient();
      let fullDoc;
      
      if (linkId) {
        // Direct ID lookup
        const docResponse = await api.documents.getDocument(linkId);
        fullDoc = docResponse?.data || docResponse;
      } else {
        // Search for the document by title
        const response = await api.documents.searchDocuments(linkTitle!);
        const documents = Array.isArray(response) ? response : (response?.data || []);
        
        // Find exact match
        const exactMatch = documents.find(doc => 
          doc.title.toLowerCase() === linkTitle!.toLowerCase()
        );
        
        const doc = exactMatch || documents[0];
        
        if (!doc) {
          return {
            contents: [
              { value: `**Document not found:** ${linkTitle}` }
            ]
          };
        }
        
        // Load document content for preview
        const docResponse = await api.documents.getDocument(doc.id);
        fullDoc = docResponse?.data || docResponse;
      }
      
      // Create preview content
      if (!fullDoc) {
        return {
          contents: [
            { value: `**Document not found**` }
          ]
        };
      }
      
      const preview = fullDoc.content
        ? fullDoc.content.substring(0, 200) + (fullDoc.content.length > 200 ? '...' : '')
        : 'No content';
      
      return {
        contents: [
          { value: `**${fullDoc.title || 'Untitled'}**` },
          { value: `Type: ${fullDoc.type || 'document'}` },
          { value: preview }
        ]
      };
    } catch (error) {
      console.error('Failed to fetch document for hover:', error);
      return null;
    }
  }
}

// Definition provider for wiki links (go to definition)
export class WikiLinkDefinitionProvider implements languages.DefinitionProvider {
  async provideDefinition(
    model: editor.ITextModel,
    position: Position,
    _token: CancellationToken
  ): Promise<languages.Definition | null> {
    // Get the line text
    const lineText = model.getLineContent(position.lineNumber);
    
    // Check if we're on a wiki link
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const embedLinkRegex = /!\[\[([^\]]+)\]\]/g;
    const mentionLinkRegex = /@\[\[([^\]]+)\]\]/g;
    
    // UUID regex pattern
    const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    const idLinkRegex = new RegExp(`\\[\\[(${uuidPattern})(?:\\|[^\\]]+)?\\]\\]`, 'gi');
    const embedIdLinkRegex = new RegExp(`!\\[\\[(${uuidPattern})(?:\\|[^\\]]+)?\\]\\]`, 'gi');
    const mentionIdLinkRegex = new RegExp(`@\\[\\[(${uuidPattern})(?:\\|[^\\]]+)?\\]\\]`, 'gi');
    
    let match;
    let linkTitle = null;
    let linkId = null;
    
    // Try to match ID-based links first
    for (const regex of [idLinkRegex, embedIdLinkRegex, mentionIdLinkRegex]) {
      regex.lastIndex = 0;
      while ((match = regex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        
        // Check if position is within the link
        if (position.column >= start + 1 && position.column <= end + 1) {
          linkId = match[1];
          break;
        }
      }
      if (linkId) break;
    }
    
    // If no ID link found, try title-based links
    if (!linkId) {
      for (const regex of [wikiLinkRegex, embedLinkRegex, mentionLinkRegex]) {
        regex.lastIndex = 0;
        while ((match = regex.exec(lineText)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          
          // Check if position is within the link
          if (position.column >= start + 1 && position.column <= end + 1) {
            linkTitle = match[1];
            break;
          }
        }
        if (linkTitle) break;
      }
    }
    
    if (!linkTitle && !linkId) return null;
    
    try {
      const api = getApiClient();
      let docId: string | null = null;
      
      if (linkId) {
        // Direct ID
        docId = linkId;
      } else {
        // Search for the document by title
        const response = await api.documents.searchDocuments(linkTitle!);
        const documents = Array.isArray(response) ? response : (response?.data || []);
        
        // Find exact match
        const exactMatch = documents.find(doc => 
          doc.title.toLowerCase() === linkTitle!.toLowerCase()
        );
        
        const doc = exactMatch || documents[0];
        if (doc) {
          docId = doc.id;
        }
      }
      
      if (docId) {
        // Return a "definition" that includes the document ID
        // Monaco will handle this as a navigation request
        return {
          uri: model.uri.with({ path: `/document/${docId}` }),
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1
          }
        };
      }
    } catch (error) {
      console.error('Failed to resolve document link:', error);
    }
    
    return null;
  }
}