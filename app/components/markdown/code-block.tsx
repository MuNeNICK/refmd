'use client';

import React, { lazy, Suspense } from 'react';

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
  return (
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
  );
}