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
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
        }}
        className={className}
      >
        {children}
      </SyntaxHighlighter>
    </Suspense>
  );
}