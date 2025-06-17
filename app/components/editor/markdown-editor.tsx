'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { EditorToolbar } from './editor-toolbar';
import type { ViewMode } from '@/components/layout/header';
import { CursorDisplay } from './cursor-display';

// Dynamic import for y-monaco to avoid SSR issues

export interface MarkdownEditorProps {
  doc: Y.Doc | null;
  awareness: Awareness | null;
  connected: boolean;
  onMount?: (editorInstance: editor.IStandaloneCodeEditor) => void;
  onSelectionChange?: (selection: unknown) => void;
  onScroll?: (scrollTop: number, scrollPercentage: number) => void;
  scrollToLine?: number;
  scrollPercentage?: number;
  onContentStatsChange?: (stats: { wordCount: number; charCount: number }) => void;
  syncScroll?: boolean;
  onSyncScrollToggle?: () => void;
  viewMode?: ViewMode;
  onFileUpload?: () => void;
  isDragOver?: boolean;
  onEditorReady?: (insertText: (text: string) => void) => void;
  userName?: string;
  userId?: string;
}

function generateUserColor(userId?: string, light = false): string {
  // Generate a consistent color based on user ID
  let hash = 0;
  const str = userId || Math.random().toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const hue = Math.abs(hash) % 360;
  const saturation = light ? 30 : 70;
  const lightness = light ? 80 : 50;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function MarkdownEditor({
  doc,
  awareness,
  connected,
  onMount,
  onSelectionChange,
  onScroll,
  scrollToLine,
  scrollPercentage,
  onContentStatsChange,
  syncScroll,
  onSyncScrollToggle,
  viewMode,
  onFileUpload,
  isDragOver,
  onEditorReady,
  userName,
  userId,
}: MarkdownEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoBindingRef = useRef<unknown>(null);
  const monacoRef = useRef<unknown>(null);
  
  
  // Track when editor is mounted
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  
  // Insert text at cursor position
  const insertTextAtCursor = useCallback((text: string) => {
    if (!editorRef.current || !doc) return;
    
    const editor = editorRef.current;
    const position = editor.getPosition();
    if (!position) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    
    // Use model's applyEdits to ensure proper Yjs synchronization
    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    };
    
    const edits = [{
      range: range,
      text: text,
      forceMoveMarkers: true
    }];
    
    // Apply the edit through the model
    model.applyEdits(edits);
    
    // Force a change event to ensure Yjs picks up the change
    model.pushStackElement();
    
    // Set cursor position after the inserted text
    const newColumn = position.column + text.length;
    editor.setPosition({
      lineNumber: position.lineNumber,
      column: newColumn
    });
    editor.focus();
  }, [doc]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (onEditorReady && insertTextAtCursor) {
      onEditorReady(insertTextAtCursor);
    }
  }, [onEditorReady, insertTextAtCursor]);

  // Set up Monaco binding when doc, awareness, and editor are ready
  useEffect(() => {
    // Skip if binding already exists
    if (monacoBindingRef.current) {
      return;
    }
    
    if (!doc || !awareness || !monacoEditor) {
      return;
    }
    
    // Check if model exists
    const model = monacoEditor.getModel();
    if (!model) {
      console.warn('Monaco editor model not available');
      return;
    }
    
    let bindingCreated = false;
    
    // Dynamically import MonacoBinding to avoid SSR issues
    import('y-monaco').then(({ MonacoBinding }) => {
      // Double-check everything is still valid
      if (!monacoEditor || !doc || !awareness || monacoBindingRef.current) {
        return;
      }
      
      const yText = doc.getText('content');
      
      try {
        // Create Monaco binding with awareness support
        const binding = new MonacoBinding(
          yText,
          model,
          new Set([monacoEditor]),
          awareness
        );
        
        monacoBindingRef.current = binding;
        bindingCreated = true;
        
        // Set user info in awareness
        const userInfo = {
          name: userName || 'Anonymous',
          color: generateUserColor(userId),
          colorLight: generateUserColor(userId, true),
          id: userId || awareness.clientID.toString(),
        };
        awareness.setLocalStateField('user', userInfo);
        
      } catch (error) {
        console.error('Failed to create MonacoBinding:', error);
      }
    }).catch((error) => {
      console.error('Failed to import y-monaco:', error);
    });
    
    return () => {
      // Use a flag to track if we should cleanup
      const shouldCleanup = bindingCreated;
      
      // Small delay to prevent cleanup during StrictMode double mount
      setTimeout(() => {
        // Only cleanup if we created a binding and it's still the current one
        if (shouldCleanup && monacoBindingRef.current) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (monacoBindingRef.current as any).destroy();
          } catch (error) {
            console.error('Error destroying MonacoBinding:', error);
          } finally {
            monacoBindingRef.current = null;
          }
        }
      }, 100);
    };
  }, [doc, awareness, monacoEditor, userName, userId]);

  // Inject dynamic CSS for remote cursor colors
  useEffect(() => {
    if (!awareness) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'collaborative-cursor-styles';
    document.head.appendChild(styleElement);

    const updateStyles = () => {
      const states = awareness.getStates();
      let css = '';
      
      states.forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          const user = state.user;
          const color = user.color || '#000000';
          const colorLight = user.colorLight || color;
          
          css += `
            .yRemoteSelection-${clientId} {
              background-color: ${colorLight};
              opacity: 0.5;
            }
            .yRemoteSelectionHead-${clientId} {
              border-color: ${color};
            }
            .yRemoteSelectionHead-${clientId}::after {
              background-color: ${color};
              border-color: ${color};
            }
            .yRemoteCursorLabel-${clientId} {
              background-color: ${color};
              color: white;
              opacity: 1;
            }
          `;
        }
      });
      
      styleElement.textContent = css;
    };

    // Initial update
    updateStyles();

    // Update on awareness changes
    const handler = () => updateStyles();
    awareness.on('update', handler);

    return () => {
      awareness.off('update', handler);
      styleElement.remove();
    };
  }, [awareness]);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoEditor(editor);

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true,
      },
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: false,
      formatOnType: false,
      suggestOnTriggerCharacters: true,
    });

    // Set up scroll listener with throttling
    let scrollRafId: number | null = null;
    editor.onDidScrollChange((e) => {
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
      }
      
      scrollRafId = requestAnimationFrame(() => {
        const scrollHeight = editor.getScrollHeight();
        const height = editor.getLayoutInfo().height;
        const scrollPercentage = e.scrollTop / (scrollHeight - height);
        onScroll?.(e.scrollTop, scrollPercentage);
        scrollRafId = null;
      });
    });

    // Set up selection listener
    editor.onDidChangeCursorSelection((e) => {
      onSelectionChange?.(e.selection);
    });

    // Update counts
    const updateCounts = () => {
      const content = editor.getValue();
      const words = content.match(/\b\w+\b/g) || [];
      const newWordCount = words.length;
      const newCharCount = content.length;
      
      // Notify parent component
      onContentStatsChange?.({ wordCount: newWordCount, charCount: newCharCount });
    };

    // Initial count
    updateCounts();

    // Listen for content changes
    editor.onDidChangeModelContent(updateCounts);
    
    // Call onMount callback if provided
    if (onMount) {
      onMount(editor);
    }
    
    // Cleanup function for scroll listener
    return () => {
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
      }
    };
  }, [onMount, onScroll, onSelectionChange, onContentStatsChange]);

  // Handle scroll to line
  useEffect(() => {
    if (scrollToLine && editorRef.current) {
      editorRef.current.revealLineInCenter(scrollToLine);
    }
  }, [scrollToLine]);

  // Handle scroll synchronization from preview (percentage-based)
  useEffect(() => {
    if (scrollPercentage !== undefined && editorRef.current) {
      const scrollHeight = editorRef.current.getScrollHeight();
      const height = editorRef.current.getLayoutInfo().height;
      const scrollTop = scrollPercentage * (scrollHeight - height);
      editorRef.current.setScrollTop(scrollTop);
    }
  }, [scrollPercentage]);


  // Handle toolbar commands
  const handleCommand = useCallback((command: string, value?: number) => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (!selection) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    const selectedText = model.getValueInRange(selection);
    let newText = '';
    let replaceSelection = false;
    let cursorOffset = 0;
    
    switch (command) {
      case 'bold':
        if (selectedText) {
          newText = `**${selectedText}**`;
          replaceSelection = true;
        } else {
          newText = '****';
          cursorOffset = 2;
        }
        break;
        
      case 'italic':
        if (selectedText) {
          newText = `*${selectedText}*`;
          replaceSelection = true;
        } else {
          newText = '**';
          cursorOffset = 1;
        }
        break;
        
      case 'strikethrough':
        if (selectedText) {
          newText = `~~${selectedText}~~`;
          replaceSelection = true;
        } else {
          newText = '~~~~';
          cursorOffset = 2;
        }
        break;
        
      case 'heading':
        const level = value || 1;
        const lineNumber = selection.startLineNumber;
        const lineContent = model.getLineContent(lineNumber);
        const lineStart = { lineNumber, column: 1 };
        const lineEnd = { lineNumber, column: lineContent.length + 1 };
        
        // Remove existing heading markers
        const cleanedLine = lineContent.replace(/^#+\s*/, '');
        const headingPrefix = '#'.repeat(level) + ' ';
        
        model.applyEdits([{
          range: {
            startLineNumber: lineStart.lineNumber,
            startColumn: lineStart.column,
            endLineNumber: lineEnd.lineNumber,
            endColumn: lineEnd.column
          },
          text: headingPrefix + cleanedLine,
          forceMoveMarkers: true
        }]);
        
        // Set cursor to end of line
        editor.setPosition({
          lineNumber: lineNumber,
          column: headingPrefix.length + cleanedLine.length + 1
        });
        editor.focus();
        return;
        
      case 'unordered-list':
        insertListItem(editor, model, selection, '- ');
        return;
        
      case 'ordered-list':
        insertListItem(editor, model, selection, '1. ');
        return;
        
      case 'task-list':
        insertListItem(editor, model, selection, '- [ ] ');
        return;
        
      case 'quote':
        insertBlockPrefix(editor, model, selection, '> ');
        return;
        
      case 'code':
        if (selectedText) {
          newText = `\`${selectedText}\``;
          replaceSelection = true;
        } else {
          newText = '``';
          cursorOffset = 1;
        }
        break;
        
      case 'link':
        if (selectedText) {
          newText = `[${selectedText}]()`;
          replaceSelection = true;
          // Position cursor inside the parentheses
          cursorOffset = -1;
        } else {
          newText = '[]()';
          cursorOffset = 1;
        }
        break;
        
      case 'image':
        if (selectedText) {
          newText = `![${selectedText}]()`;
          replaceSelection = true;
          // Position cursor inside the parentheses for URL
          cursorOffset = -1;
        } else {
          newText = '![]()';
          cursorOffset = 3; // Position cursor inside brackets for alt text
        }
        break;
        
      case 'table':
        newText = `| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |`;
        break;
        
      case 'horizontal-rule':
        newText = '\n---\n';
        break;
        
      default:
        return;
    }
    
    // Apply the edit
    if (replaceSelection && selectedText) {
      model.applyEdits([{
        range: selection,
        text: newText,
        forceMoveMarkers: true
      }]);
      
      // Special handling for link and image commands - position cursor inside parentheses
      if (command === 'link' || command === 'image') {
        const newPos = selection.startColumn + newText.length - 1; // Position inside parentheses
        editor.setPosition({
          lineNumber: selection.startLineNumber,
          column: newPos
        });
      }
    } else {
      insertTextAtCursor(newText);
      
      // Move cursor if needed
      if (cursorOffset > 0) {
        const pos = editor.getPosition();
        if (pos) {
          editor.setPosition({
            lineNumber: pos.lineNumber,
            column: pos.column - (newText.length - cursorOffset)
          });
        }
      }
    }
    
    editor.focus();
  }, [insertTextAtCursor]);
  
  // Helper function to insert list items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertListItem = (editor: editor.IStandaloneCodeEditor, model: editor.ITextModel, selection: any, prefix: string) => {
    const lineNumber = selection.startLineNumber;
    const lineContent = model.getLineContent(lineNumber);
    const lineStart = { lineNumber, column: 1 };
    
    // Check if line already has the prefix
    if (lineContent.trimStart().startsWith(prefix.trim())) {
      return;
    }
    
    model.applyEdits([{
      range: {
        startLineNumber: lineStart.lineNumber,
        startColumn: lineStart.column,
        endLineNumber: lineStart.lineNumber,
        endColumn: lineStart.column
      },
      text: prefix,
      forceMoveMarkers: true
    }]);
    
    editor.setPosition({
      lineNumber: lineNumber,
      column: prefix.length + 1
    });
    editor.focus();
  };
  
  // Helper function to insert block prefixes (like quotes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertBlockPrefix = (editor: editor.IStandaloneCodeEditor, model: editor.ITextModel, selection: any, prefix: string) => {
    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;
    
    const edits: editor.IIdentifiedSingleEditOperation[] = [];
    
    for (let line = startLine; line <= endLine; line++) {
      const lineContent = model.getLineContent(line);
      if (!lineContent.startsWith(prefix)) {
        edits.push({
          range: {
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: 1
          },
          text: prefix,
          forceMoveMarkers: true
        });
      }
    }
    
    if (edits.length > 0) {
      model.applyEdits(edits);
    }
    
    editor.focus();
  };

  return (
    <div className="h-full bg-background dark:bg-[#1e1e1e] relative flex flex-col">
      <EditorToolbar
        onCommand={handleCommand}
        syncScroll={syncScroll}
        onSyncScrollToggle={onSyncScrollToggle}
        viewMode={viewMode || "editor"}
        onFileUpload={onFileUpload}
      />
      <div className="flex-1 overflow-hidden relative">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onMount={handleEditorMount}
          options={{
            automaticLayout: true,
            fontSize: 16,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading editor...</div>
            </div>
          }
        />
        
        {/* Cursor display for active users */}
        {awareness && connected && (
          <CursorDisplay awareness={awareness} className="z-10" />
        )}
        
        {/* Drag and Drop Overlay */}
        {isDragOver && (
          <div 
            className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none"
            style={{ 
              transition: 'opacity 150ms ease-in-out',
              animation: 'none'
            }}
          >
            <div className="text-center text-primary">
              <div className="h-12 w-12 mx-auto mb-4 flex items-center justify-center">
                <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg font-medium">Drop files to upload</p>
              <p className="text-sm opacity-75">Supports images, PDFs, and text files</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export the insertTextAtCursor functionality
export const useInsertText = (doc: Y.Doc | null, editorRef: React.RefObject<editor.IStandaloneCodeEditor | null>) => {
  return useCallback((text: string) => {
    if (!editorRef.current || !doc) return;
    
    const editor = editorRef.current;
    const position = editor.getPosition();
    if (!position) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    // Use model's applyEdits to ensure proper Yjs synchronization
    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    };
    
    const edits = [{
      range: range,
      text: text,
      forceMoveMarkers: true
    }];
    
    // Apply the edit through the model
    model.applyEdits(edits);
    
    // Set cursor position after the inserted text
    const newColumn = position.column + text.length;
    editor.setPosition({
      lineNumber: position.lineNumber,
      column: newColumn
    });
    editor.focus();
  }, [doc, editorRef]);
};