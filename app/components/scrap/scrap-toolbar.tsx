'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, Italic, Heading1, List, Link, Code, Quote, Paperclip, FileText
} from 'lucide-react';

interface ScrapToolbarProps {
  onFormatClick: (format: string) => void;
  onFileUpload?: () => void;
  onDocumentLink?: () => void;
  disabled?: boolean;
  showFileUpload?: boolean;
}

export function ScrapToolbar({ 
  onFormatClick, 
  onFileUpload,
  onDocumentLink, 
  disabled = false,
  showFileUpload = true 
}: ScrapToolbarProps) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onFormatClick('bold')}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onFormatClick('italic')}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onFormatClick('heading')}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title="Heading"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onFormatClick('list')}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title="List"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onFormatClick('quote')}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title="Quote"
      >
        <Quote className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onFormatClick('code')}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title="Code"
      >
        <Code className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onFormatClick('link')}
        disabled={disabled}
        className="h-7 w-7 p-0"
        title="Link"
      >
        <Link className="h-3.5 w-3.5" />
      </Button>
      {onDocumentLink && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDocumentLink}
          disabled={disabled}
          className="h-7 w-7 p-0"
          title="Document Link"
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
      )}
      {showFileUpload && onFileUpload && (
        <>
          <div className="w-px h-4 bg-border mx-0.5" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFileUpload}
            disabled={disabled}
            className="h-7 w-7 p-0"
            title="Upload file"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}