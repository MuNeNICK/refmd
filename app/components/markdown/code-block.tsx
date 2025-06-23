'use client';

import React, { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

// Dynamically import syntax highlighter to reduce bundle size
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter').then(mod => ({
    default: mod.Prism
  }))
);

// Import style statically as it's small
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  language?: string;
  children: string;
  className?: string;
}

function CodeBlockSkeleton() {
  return (
    <div className="animate-pulse bg-muted rounded-md p-4 my-2">
      <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
    </div>
  );
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="relative group">
      <Button
        variant="outline"
        size="icon"
        onClick={() => copyToClipboard(children)}
        className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      <Suspense fallback={<CodeBlockSkeleton />}>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          PreTag="pre"
          customStyle={{
            margin: '0 0 1rem 0',
            padding: '1rem',
            backgroundColor: 'rgb(31, 41, 55)',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            borderRadius: '0.5rem',
            overflow: 'auto',
          }}
          codeTagProps={{
            style: {
              textShadow: 'none',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: '0.875rem',
              lineHeight: '1.5',
            },
          }}
          className={`syntax-highlighter ${className || ''}`}
        >
          {children}
        </SyntaxHighlighter>
      </Suspense>
    </div>
  );
}