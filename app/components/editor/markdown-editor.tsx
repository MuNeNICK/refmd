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
import { WikiLinkCompletionProvider, WikiLinkHoverProvider, WikiLinkDefinitionProvider } from '@/lib/monaco/wiki-link-provider';

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
  documentPath?: string;
  readOnly?: boolean;
  onFilePaste?: (files: File[]) => void;
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
  readOnly = false,
  onFilePaste,
}: MarkdownEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoBindingRef = useRef<unknown>(null);
  const monacoRef = useRef<unknown>(null);
  // Import type from monaco-vim
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);
  const vimStatusBarRef = useRef<HTMLDivElement | null>(null);
  const [vimStatus, setVimStatus] = useState<string>('');
  
  // Store disposables for wiki link providers
  const wikiLinkProvidersRef = useRef<{ dispose: () => void }[]>([]);
  
  // Track when editor is mounted
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  
  // Track content statistics
  const [contentStats, setContentStats] = useState({ wordCount: 0, charCount: 0 });
  
  // Track Vim mode state
  const [isVimMode, setIsVimMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('editorVimMode') === 'true';
    }
    return false;
  });
  
  
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
  
  // Handle pasted files (images, PDFs, documents, etc.)
  const handleFilePaste = useCallback((files: File[]) => {
    if (onFilePaste) {
      onFilePaste(files);
    }
  }, [onFilePaste]);

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
    
    // Track if this effect has been cleaned up to prevent double cleanup
    let isCleanedUp = false;
    
    // Dynamically import MonacoBinding to avoid SSR issues
    import('y-monaco').then(({ MonacoBinding }) => {
      // Double-check everything is still valid and not cleaned up
      if (isCleanedUp || !monacoEditor || !doc || !awareness || monacoBindingRef.current) {
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
      isCleanedUp = true;
      
      // Cleanup immediately to ensure it happens before awareness is destroyed
      // Store the binding reference
      const bindingToCleanup = monacoBindingRef.current;
      monacoBindingRef.current = null; // Clear ref immediately to prevent double cleanup
      
      if (bindingToCleanup) {
        // Small delay only for the actual destroy call
        setTimeout(() => {
          try {
            const binding = bindingToCleanup as unknown as { destroy?: () => void; _destroyed?: boolean };
            // Check if destroy method exists and binding hasn't been destroyed
            if (binding && typeof binding.destroy === 'function' && !binding._destroyed) {
              binding.destroy();
            }
          } catch (error) {
            // Silently ignore "event handler doesn't exist" errors
            if (!(error as Error)?.message?.includes('event handler')) {
              console.error('Error destroying MonacoBinding:', error);
            }
          }
        }, 50); // Shorter delay than awareness cleanup (100ms)
      }
    };
  }, [doc, awareness, monacoEditor, userName, userId]);

  // Inject dynamic CSS for remote cursor colors
  useEffect(() => {
    if (!awareness || (awareness as unknown as { _destroyed?: boolean })._destroyed) return;

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
      // Check if awareness still exists and hasn't been destroyed
      if (awareness && typeof awareness.off === 'function' && !(awareness as unknown as { _destroyed?: boolean })._destroyed) {
        try {
          awareness.off('update', handler);
        } catch (error) {
          // Ignore errors when removing handlers - awareness might already be destroyed
          if (!(error as Error)?.message?.includes('event handler')) {
            console.error('Error removing awareness handler:', error);
          }
        }
      }
      if (styleElement && styleElement.parentNode) {
        styleElement.remove();
      }
    };
  }, [awareness]);

  // Toggle Vim mode
  const toggleVimMode = useCallback(() => {
    const newVimMode = !isVimMode;
    setIsVimMode(newVimMode);
    
    // Save preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('editorVimMode', newVimMode.toString());
    }
  }, [isVimMode]);
  
  // Initialize or dispose Vim mode
  useEffect(() => {
    if (!monacoEditor || !monacoRef.current) return;
    
    const initVimMode = async () => {
      if (isVimMode && !vimModeRef.current) {
        try {
          // Dynamically import monaco-vim
          const { initVimMode: initVim } = await import('monaco-vim');
          
          // Create hidden status bar element if it doesn't exist
          if (!vimStatusBarRef.current) {
            const statusBar = document.createElement('div');
            statusBar.style.display = 'none';
            statusBar.style.position = 'fixed';
            statusBar.style.visibility = 'hidden';
            statusBar.style.top = '-9999px';
            statusBar.style.left = '-9999px';
            statusBar.style.width = '1px';
            statusBar.style.height = '1px';
            statusBar.style.overflow = 'hidden';
            document.body.appendChild(statusBar);
            vimStatusBarRef.current = statusBar;
            
            // Set up mutation observer to track status changes
            const observer = new MutationObserver(() => {
              const statusText = vimStatusBarRef.current?.textContent || '';
              setVimStatus(statusText);
            });
            
            observer.observe(statusBar, { 
              childList: true, 
              characterData: true, 
              subtree: true 
            });
          }
          
          // Initialize Vim mode
          vimModeRef.current = initVim(monacoEditor, vimStatusBarRef.current);
          
          // Fix any extra padding/margin that monaco-vim might add
          const editorContainer = monacoEditor.getContainerDomNode();
          if (editorContainer) {
            const overflowGuard = editorContainer.querySelector('.overflow-guard');
            if (overflowGuard) {
              (overflowGuard as HTMLElement).style.paddingBottom = '0';
            }
          }
          
          // Focus editor to ensure Vim mode is active
          monacoEditor.focus();
        } catch (error) {
          console.error('Failed to initialize Vim mode:', error);
        }
      } else if (!isVimMode && vimModeRef.current) {
        // Dispose Vim mode
        try {
          vimModeRef.current.dispose();
          vimModeRef.current = null;
          
          // Clear vim status
          setVimStatus('');
          
          // Restore normal mode
          monacoEditor.focus();
        } catch (error) {
          console.error('Failed to dispose Vim mode:', error);
        }
      }
    };
    
    initVimMode();
    
    return () => {
      // Cleanup on unmount
      if (vimModeRef.current) {
        try {
          vimModeRef.current.dispose();
          vimModeRef.current = null;
        } catch (error) {
          console.error('Error disposing Vim mode on unmount:', error);
        }
      }
      
      // Clear vim status
      setVimStatus('');
      
      // Remove status bar on unmount
      if (vimStatusBarRef.current && vimStatusBarRef.current.parentNode) {
        vimStatusBarRef.current.parentNode.removeChild(vimStatusBarRef.current);
        vimStatusBarRef.current = null;
      }
    };
  }, [isVimMode, monacoEditor, monacoRef]);
  
  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoEditor(editor);
    
    // Set up paste handler for files (images, PDFs, documents, etc.)
    // Only set up if we have a handler function
    if (handleFilePaste) {
      const pasteHandler = (e: ClipboardEvent) => {
        // Check if the paste event is happening within the editor
        const target = e.target as HTMLElement;
        const editorDomNode = editor.getDomNode();
        
        if (!editorDomNode || !editorDomNode.contains(target)) {
          // Paste is not in our editor, ignore
          return;
        }
        
        const clipboardData = e.clipboardData;
        
        // Check if we have files in the clipboard
        if (clipboardData?.files && clipboardData.files.length > 0) {
          // Get all files from clipboard
          const files = Array.from(clipboardData.files);
          
          // Filter out empty files (sometimes clipboard contains empty file entries)
          const validFiles = files.filter(file => file.size > 0);
          
          // Only prevent default if we have valid files to handle
          if (validFiles.length > 0) {
              e.preventDefault();
            e.stopPropagation();
            
            // Handle all pasted files (images and other types)
            handleFilePaste(validFiles);
            return;
          }
        }
        
        // Let normal text paste go through - don't prevent default
      };
      
      // Add paste listener at document level
      document.addEventListener('paste', pasteHandler, true);
      
      // Store the handler for cleanup
      const editorWithHandler = editor as editor.IStandaloneCodeEditor & {
        _imagePasteHandler?: (e: ClipboardEvent) => void;
      };
      editorWithHandler._imagePasteHandler = pasteHandler;
    }

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
      scrollBeyondLastLine: true,
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
      readOnly: readOnly,
      // Ensure paste is enabled
      domReadOnly: readOnly, // This is important - it controls whether DOM operations like paste are allowed
      copyWithSyntaxHighlighting: true,
      emptySelectionClipboard: true,
      dragAndDrop: true,
    });

    // Add custom action for handling Enter key in lists
    editor.addAction({
      id: 'markdown-list-continuation',
      label: 'Continue Markdown List',
      keybindings: [monaco.KeyCode.Enter],
      precondition: '!suggestWidgetVisible && !inSnippetMode',
      run: function(ed: editor.ICodeEditor) {
        const model = ed.getModel();
        const position = ed.getPosition();
        
        if (!model || !position) {
          // Fall back to default behavior
          ed.trigger('keyboard', 'type', { text: '\n' });
          return;
        }
        
        const lineNumber = position.lineNumber;
        const lineContent = model.getLineContent(lineNumber);
        const cursorColumn = position.column;
        
        // Get the content before cursor to check for list patterns
        const contentBeforeCursor = lineContent.substring(0, cursorColumn - 1);
        
        // Regular expressions for different list types
        const unorderedListRegex = /^(\s*)([-*+])\s(.*)$/;
        const orderedListRegex = /^(\s*)(\d+)\.\s(.*)$/;
        const taskListRegex = /^(\s*)([-*+])\s\[([x\s])\]\s(.*)$/;
        
        // Check if current line is a list item
        let match;
        let listType = null;
        let indent = '';
        let marker = '';
        let content = '';
        
        if ((match = taskListRegex.exec(lineContent))) {
          listType = 'task';
          indent = match[1];
          marker = match[2];
          content = match[3];
        } else if ((match = unorderedListRegex.exec(lineContent))) {
          listType = 'unordered';
          indent = match[1];
          marker = match[2];
          content = match[3];
        } else if ((match = orderedListRegex.exec(lineContent))) {
          listType = 'ordered';
          indent = match[1];
          marker = match[2];
          content = match[3];
        }
        
        if (!listType) {
          // Not a list, use default behavior
          ed.trigger('keyboard', 'type', { text: '\n' });
          return;
        }
        
        // Check if the list item is empty (just the marker)
        const isEmptyItem = content.trim() === '' && cursorColumn <= contentBeforeCursor.length + 1;
        
        if (isEmptyItem) {
          // Empty list item - remove the marker and exit list mode
          const range = {
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: model.getLineMaxColumn(lineNumber)
          };
          
          // Replace with just the indentation (removes the list marker)
          model.applyEdits([{
            range: range,
            text: indent,
            forceMoveMarkers: true
          }]);
          
          // Position cursor at the proper indentation
          ed.setPosition({
            lineNumber: lineNumber,
            column: indent.length + 1
          });
          
          return;
        }
        
        // Continue the list
        let newLineContent = '\n' + indent;
        
        switch (listType) {
          case 'task':
            newLineContent += marker + ' [ ] ';
            break;
          case 'unordered':
            newLineContent += marker + ' ';
            break;
          case 'ordered':
            const nextNumber = parseInt(marker) + 1;
            newLineContent += nextNumber + '. ';
            break;
        }
        
        // Insert the new line
        ed.trigger('keyboard', 'type', { text: newLineContent });
      }
    });

    // Add custom action for Tab key to indent lists
    editor.addAction({
      id: 'markdown-indent-list',
      label: 'Indent Markdown List',
      keybindings: [monaco.KeyCode.Tab],
      precondition: '!suggestWidgetVisible && !inSnippetMode',
      run: function(ed: editor.ICodeEditor) {
        const model = ed.getModel();
        const selection = ed.getSelection();
        
        if (!model || !selection) {
          // Fall back to default behavior
          ed.trigger('keyboard', 'tab', {});
          return;
        }
        
        const lineNumber = selection.startLineNumber;
        const lineContent = model.getLineContent(lineNumber);
        
        // Check if current line is a list item
        const listPatterns = [
          /^(\s*)([-*+])\s(.*)$/,           // Unordered list
          /^(\s*)(\d+)\.\s(.*)$/,           // Ordered list
          /^(\s*)([-*+])\s\[([x\s])\]\s(.*)$/ // Task list
        ];
        
        let isListItem = false;
        for (const pattern of listPatterns) {
          if (pattern.test(lineContent)) {
            isListItem = true;
            break;
          }
        }
        
        if (isListItem) {
          // Add 2 spaces at the beginning of the line
          const range = new monaco.Range(lineNumber, 1, lineNumber, 1);
          const edits = [{
            range: range,
            text: '  ',
            forceMoveMarkers: true
          }];
          
          // Apply the edit
          ed.executeEdits('markdown-indent-list', edits);
          
          // Move cursor to maintain relative position
          const newPosition = new monaco.Position(lineNumber, selection.startColumn + 2);
          ed.setPosition(newPosition);
        } else {
          // Fall back to default tab behavior
          ed.trigger('keyboard', 'tab', {});
        }
      }
    });

    // Add custom action for Shift+Tab to unindent lists
    editor.addAction({
      id: 'markdown-unindent-list',
      label: 'Unindent Markdown List',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Tab],
      precondition: '!suggestWidgetVisible && !inSnippetMode',
      run: function(ed: editor.ICodeEditor) {
        const model = ed.getModel();
        const selection = ed.getSelection();
        
        if (!model || !selection) {
          // Fall back to default behavior
          ed.trigger('keyboard', 'outdent', {});
          return;
        }
        
        const lineNumber = selection.startLineNumber;
        const lineContent = model.getLineContent(lineNumber);
        
        // Check if current line is a list item
        const listPatterns = [
          /^(\s*)([-*+])\s(.*)$/,           // Unordered list
          /^(\s*)(\d+)\.\s(.*)$/,           // Ordered list
          /^(\s*)([-*+])\s\[([x\s])\]\s(.*)$/ // Task list
        ];
        
        let isListItem = false;
        let currentIndent = '';
        for (const pattern of listPatterns) {
          const match = pattern.exec(lineContent);
          if (match) {
            isListItem = true;
            currentIndent = match[1];
            break;
          }
        }
        
        if (isListItem && currentIndent.length >= 2) {
          // Remove 2 spaces from the beginning
          const range = new monaco.Range(lineNumber, 1, lineNumber, 3);
          const edits = [{
            range: range,
            text: '',
            forceMoveMarkers: true
          }];
          
          // Apply the edit
          ed.executeEdits('markdown-unindent-list', edits);
          
          // Move cursor to maintain relative position
          const newPosition = new monaco.Position(lineNumber, Math.max(1, selection.startColumn - 2));
          ed.setPosition(newPosition);
        } else {
          // Fall back to default outdent behavior
          ed.trigger('keyboard', 'outdent', {});
        }
      }
    });

    // Dispose old wiki link providers if any
    wikiLinkProvidersRef.current.forEach(disposable => disposable.dispose());
    wikiLinkProvidersRef.current = [];
    
    // Register wiki link providers and store disposables
    wikiLinkProvidersRef.current.push(
      monaco.languages.registerCompletionItemProvider('markdown', new WikiLinkCompletionProvider()),
      monaco.languages.registerHoverProvider('markdown', new WikiLinkHoverProvider()),
      monaco.languages.registerDefinitionProvider('markdown', new WikiLinkDefinitionProvider())
    );

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

    // Update counts with throttling
    let statsRafId: number | null = null;
    const updateCounts = () => {
      if (statsRafId) {
        cancelAnimationFrame(statsRafId);
      }
      
      statsRafId = requestAnimationFrame(() => {
        const content = editor.getValue();
        const words = content.match(/\b\w+\b/g) || [];
        const newWordCount = words.length;
        const newCharCount = content.length;
        
        // Update local state
        setContentStats({ wordCount: newWordCount, charCount: newCharCount });
        
        // Notify parent component
        onContentStatsChange?.({ wordCount: newWordCount, charCount: newCharCount });
        statsRafId = null;
      });
    };

    // Initial count
    updateCounts();

    // Listen for content changes
    editor.onDidChangeModelContent(updateCounts);
    
    // Call onMount callback if provided
    if (onMount) {
      onMount(editor);
    }
  }, [onMount, onScroll, onSelectionChange, onContentStatsChange, readOnly, handleFilePaste]);

  // Cleanup paste handler on unmount
  useEffect(() => {
    return () => {
      const editor = editorRef.current;
      if (editor) {
        const editorWithHandler = editor as editor.IStandaloneCodeEditor & {
          _imagePasteHandler?: (e: ClipboardEvent) => void;
        };
        const handler = editorWithHandler._imagePasteHandler;
        if (handler) {
          document.removeEventListener('paste', handler, true);
          delete editorWithHandler._imagePasteHandler;
        }
      }
    };
  }, []);

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
          newText = `[[${selectedText}]]`;
          replaceSelection = true;
        } else {
          newText = '[[]]';
          cursorOffset = 2;
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
  
  // Cleanup wiki link providers on unmount
  useEffect(() => {
    return () => {
      wikiLinkProvidersRef.current.forEach(disposable => disposable.dispose());
      wikiLinkProvidersRef.current = [];
    };
  }, []);

  return (
    <div className="h-full bg-background dark:bg-[#1e1e1e] relative flex flex-col">
      <EditorToolbar
        onCommand={handleCommand}
        syncScroll={syncScroll}
        onSyncScrollToggle={onSyncScrollToggle}
        viewMode={viewMode || "editor"}
        onFileUpload={onFileUpload}
        isVimMode={isVimMode}
        onVimModeToggle={toggleVimMode}
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
              scrollBeyondLastLine: true,
              // Ensure clipboard operations work
              copyWithSyntaxHighlighting: true,
              emptySelectionClipboard: true,
              dragAndDrop: true,
              readOnly: readOnly,
              domReadOnly: readOnly,
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
      
      {/* Editor footer with content statistics */}
      <div className="flex-shrink-0 border-t bg-muted/30 px-4 py-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {/* Vim status on the left, like traditional Vim */}
          <div className="flex items-center min-w-[200px]">
            {isVimMode && vimStatus ? (
              <span className="font-mono font-semibold">{vimStatus}</span>
            ) : (
              <span className="invisible">--</span> // Placeholder to maintain height
            )}
          </div>
          
          {/* Word and character count on the right */}
          <div className="flex items-center gap-4">
            <span>{contentStats.wordCount} words</span>
            <span>{contentStats.charCount} characters</span>
          </div>
        </div>
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