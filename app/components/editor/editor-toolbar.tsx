"use client";

import React, { useState, memo, useCallback } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Table,
  Minus,
  CheckSquare,
  MoreHorizontal,
  ArrowUpDown,
  Ban,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/components/layout/header";
import { VimModeToggle } from "./vim-mode-toggle";

interface EditorToolbarProps {
  onCommand: (command: string, value?: number) => void;
  className?: string;
  syncScroll?: boolean;
  onSyncScrollToggle?: () => void;
  onFileUpload?: () => void;
  viewMode?: ViewMode;
  isVimMode?: boolean;
  onVimModeToggle?: () => void;
  onBacklinksToggle?: () => void;
  showBacklinks?: boolean;
}

interface ToolbarButton {
  icon: React.ReactNode;
  command: string;
  title: string;
  value?: number;
}

function EditorToolbarComponent({ 
  onCommand, 
  className, 
  syncScroll, 
  onSyncScrollToggle, 
  onFileUpload,
  viewMode,
  isVimMode,
  onVimModeToggle,
  onBacklinksToggle,
  showBacklinks,
}: EditorToolbarProps) {
  const primaryButtons: (ToolbarButton | "separator")[] = [
    { icon: <Bold className="h-4 w-4" />, command: "bold", title: "Bold" },
    { icon: <Italic className="h-4 w-4" />, command: "italic", title: "Italic" },
    "separator",
    { icon: <Heading1 className="h-4 w-4" />, command: "heading", title: "Heading 1", value: 1 },
    { icon: <List className="h-4 w-4" />, command: "unordered-list", title: "List" },
    { icon: <Link className="h-4 w-4" />, command: "link", title: "Link" },
  ];
  
  const secondaryButtons: (ToolbarButton | "separator")[] = [
    { icon: <Strikethrough className="h-4 w-4" />, command: "strikethrough", title: "Strikethrough" },
    "separator",
    { icon: <ListOrdered className="h-4 w-4" />, command: "ordered-list", title: "Numbered List" },
    { icon: <CheckSquare className="h-4 w-4" />, command: "task-list", title: "Task List" },
    "separator",
    { icon: <Quote className="h-4 w-4" />, command: "quote", title: "Quote" },
    { icon: <Code className="h-4 w-4" />, command: "code", title: "Code" },
    { icon: <Table className="h-4 w-4" />, command: "table", title: "Table" },
    { icon: <Minus className="h-4 w-4" />, command: "horizontal-rule", title: "Horizontal Rule" },
  ];

  const [showMore, setShowMore] = useState(false);
  
  const renderButtons = useCallback((buttons: (ToolbarButton | "separator")[]) => {
    return buttons.map((button, index) => {
      if (button === "separator") {
        return (
          <div
            key={`separator-${index}`}
            className="w-px h-5 bg-border mx-0.5 hidden sm:block"
          />
        );
      }

      return (
        <Button
          key={`${button.command}-${index}`}
          variant="ghost"
          size="sm"
          onClick={() => onCommand(button.command, button.value)}
          className="p-1 sm:p-1.5 h-auto w-auto text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title={button.title}
        >
          {button.icon}
        </Button>
      );
    });
  }, [onCommand]);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-0.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-background border-b border-border overflow-x-auto",
          className
        )}
      >
        {/* Primary buttons - always visible */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {renderButtons(primaryButtons)}
        </div>
        
        {/* Secondary buttons - hidden on mobile */}
        <div className="hidden md:flex items-center gap-0.5 flex-shrink-0">
          {renderButtons(secondaryButtons)}
        </div>
        
        {/* Spacer to push buttons to the right */}
        <div className="flex-1" />
        
        {/* Vim mode toggle */}
        {onVimModeToggle && (
          <VimModeToggle
            isVimMode={isVimMode || false}
            onToggle={onVimModeToggle}
          />
        )}
        
        {/* File upload button */}
        {onFileUpload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onFileUpload}
            className="p-1 sm:p-1.5 h-auto w-auto text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Upload file"
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}
        
        {/* Scroll sync button - only in split view, positioned at right */}
        {viewMode === "split" && onSyncScrollToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSyncScrollToggle}
            className="p-1 sm:p-1.5 h-auto w-auto transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground relative"
            title={syncScroll ? "Disable scroll sync" : "Enable scroll sync"}
          >
            <ArrowUpDown className="h-4 w-4" />
            {!syncScroll && (
              <Ban className="h-4 w-4 absolute inset-0 m-auto text-red-400" />
            )}
          </Button>
        )}
        
        {/* More button for mobile */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMore(!showMore)}
          className="p-1 h-auto w-auto text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:hidden ml-auto"
          title="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Mobile dropdown for secondary buttons */}
      {showMore && (
        <div className="md:hidden bg-background border-b border-border px-2 py-2">
          <div className="flex flex-wrap gap-1">
            {/* Vim mode toggle for mobile */}
            {onVimModeToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onVimModeToggle();
                  setShowMore(false);
                }}
                className="p-2 h-auto w-auto transition-colors flex items-center gap-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title={isVimMode ? "Disable Vim mode" : "Enable Vim mode"}
              >
                <span className="font-mono text-xs font-semibold">Vim</span>
                <span className="text-xs">{isVimMode ? 'On' : 'Off'}</span>
              </Button>
            )}
            
            {/* File upload button for mobile */}
            {onFileUpload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onFileUpload();
                  setShowMore(false);
                }}
                className="p-2 h-auto w-auto transition-colors flex items-center gap-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title="Upload file"
              >
                <Upload className="h-4 w-4" />
                <span className="text-xs">Upload File</span>
              </Button>
            )}
            
            {/* Scroll sync button for mobile */}
            {viewMode === "split" && onSyncScrollToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSyncScrollToggle();
                  setShowMore(false);
                }}
                className="p-2 h-auto w-auto transition-colors flex items-center gap-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                title={syncScroll ? "Disable scroll sync" : "Enable scroll sync"}
              >
                <div className="relative">
                  <ArrowUpDown className="h-4 w-4" />
                  {!syncScroll && (
                    <Ban className="h-4 w-4 absolute inset-0 text-red-400" />
                  )}
                </div>
                <span className="text-xs">Scroll Sync</span>
              </Button>
            )}
            
            {secondaryButtons.map((button, index) => {
              if (button === "separator") return null;
              
              return (
                <Button
                  key={`mobile-${button.command}-${index}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onCommand(button.command, button.value);
                    setShowMore(false);
                  }}
                  className="p-2 h-auto w-auto text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 text-sm"
                  title={button.title}
                >
                  {button.icon}
                  <span className="text-xs">{button.title}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// Export memoized component
export const EditorToolbar = memo(EditorToolbarComponent);