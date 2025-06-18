'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';

interface ScrapPostFormProps {
  initialContent?: string;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  submitLabel?: string;
}

export function ScrapPostForm({
  initialContent = '',
  onSubmit,
  onCancel,
  isLoading = false,
  placeholder = '投稿を入力...',
  submitLabel = '投稿'
}: ScrapPostFormProps) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() && !isLoading) {
      onSubmit(content.trim());
      if (!initialContent) {
        setContent('');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[100px] resize-none"
            disabled={isLoading}
          />
          
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              Markdown記法が使えます • 
              <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Ctrl</kbd>+
              <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Enter</kbd> で送信
            </div>
            
            <div className="flex gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  キャンセル
                </Button>
              )}
              
              <Button
                type="submit"
                size="sm"
                disabled={!content.trim() || isLoading}
              >
                {isLoading ? '送信中...' : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Card>
  );
}