'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
// Dynamically import mermaid to avoid SSR issues

interface MermaidDiagramProps {
  content: string;
}

export function MermaidDiagram({ content }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderDiagram = async () => {
      try {
        // Dynamically import mermaid to avoid SSR serialization issues
        const { default: mermaid } = await import('mermaid');
        
        // Initialize mermaid with config
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#6366f1',
            primaryTextColor: '#fff',
            primaryBorderColor: '#4b5563',
            lineColor: '#6b7280',
            secondaryColor: '#4b5563',
            tertiaryColor: '#374151',
            background: '#1f2937',
            mainBkg: '#111827',
            secondBkg: '#1f2937',
            tertiaryBkg: '#374151',
            secondaryBorderColor: '#374151',
            tertiaryBorderColor: '#1f2937',
            noteBorderColor: '#6366f1',
            noteTextColor: '#e5e7eb',
            darkMode: true
          }
        });

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Clear previous content
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        
        // Render the diagram
        const { svg } = await mermaid.render(id, content);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        console.error('Mermaid error:', err);
      }
    };

    renderDiagram();
  }, [content]);

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error rendering diagram: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="mermaid-container my-4 flex justify-center overflow-x-auto"
    />
  );
}