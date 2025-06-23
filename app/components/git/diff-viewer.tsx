'use client';

import React from 'react';
import { DiffResult, DiffLine } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface DiffViewerProps {
  diffResult: DiffResult;
  viewMode?: 'unified' | 'split';
  showLineNumbers?: boolean;
  highlightSyntax?: boolean;
  className?: string;
}

export function DiffViewer({
  diffResult,
  viewMode = 'unified',
  showLineNumbers = true,
  className
}: DiffViewerProps) {
  if (!diffResult.diff_lines || diffResult.diff_lines.length === 0) {
    return (
      <div className={cn("text-center py-4 text-muted-foreground", className)}>
        No changes to display
      </div>
    );
  }

  if (viewMode === 'split') {
    return <SplitDiffView diffResult={diffResult} showLineNumbers={showLineNumbers} className={className} />;
  }

  return <UnifiedDiffView diffResult={diffResult} showLineNumbers={showLineNumbers} className={className} />;
}

function UnifiedDiffView({ 
  diffResult, 
  showLineNumbers, 
  className 
}: { 
  diffResult: DiffResult; 
  showLineNumbers: boolean;
  className?: string;
}) {
  return (
    <div className={cn("font-mono text-sm overflow-x-auto", className)}>
      {(diffResult.diff_lines || []).map((line, index) => (
        <div
          key={index}
          className={cn(
            "flex",
            line.line_type === 'added' && "bg-green-50 dark:bg-green-950/30",
            line.line_type === 'deleted' && "bg-red-50 dark:bg-red-950/30",
            line.line_type === 'context' && "bg-background"
          )}
        >
          {showLineNumbers && (
            <>
              <span className="px-2 text-muted-foreground text-xs w-12 text-right select-none">
                {line.old_line_number || ''}
              </span>
              <span className="px-2 text-muted-foreground text-xs w-12 text-right select-none">
                {line.new_line_number || ''}
              </span>
            </>
          )}
          <span
            className={cn(
              "px-2 select-none",
              line.line_type === 'added' && "text-green-600 dark:text-green-400",
              line.line_type === 'deleted' && "text-red-600 dark:text-red-400",
              line.line_type === 'context' && "text-muted-foreground"
            )}
          >
            {line.line_type === 'added' ? '+' : line.line_type === 'deleted' ? '-' : ' '}
          </span>
          <span className="flex-1 whitespace-pre">{line.content}</span>
        </div>
      ))}
    </div>
  );
}

function SplitDiffView({ 
  diffResult, 
  showLineNumbers,
  className 
}: { 
  diffResult: DiffResult; 
  showLineNumbers: boolean;
  className?: string;
}) {
  // Process lines to create side-by-side view
  const processedLines: Array<{ old?: DiffLine; new?: DiffLine }> = [];
  const diffLines = diffResult.diff_lines || [];
  let i = 0;
  
  while (i < diffLines.length) {
    const line = diffLines[i];
    
    if (line.line_type === 'context') {
      processedLines.push({ old: line, new: line });
      i++;
    } else if (line.line_type === 'deleted') {
      // Look ahead for matching added lines
      let j = i + 1;
      
      while (j < diffLines.length && diffLines[j].line_type === 'deleted') {
        j++;
      }
      
      // Now j points to first non-deleted line (either added or context)
      if (j < diffLines.length && diffLines[j].line_type === 'added') {
        // We have deleted lines followed by added lines
        const deletedLines = diffLines.slice(i, j);
        let addedIndex = j;
        
        deletedLines.forEach(deletedLine => {
          if (addedIndex < diffLines.length && 
              diffLines[addedIndex].line_type === 'added') {
            processedLines.push({ 
              old: deletedLine, 
              new: diffLines[addedIndex] 
            });
            addedIndex++;
          } else {
            processedLines.push({ old: deletedLine });
          }
        });
        
        // Handle remaining added lines
        while (addedIndex < diffLines.length && 
               diffLines[addedIndex].line_type === 'added') {
          processedLines.push({ new: diffLines[addedIndex] });
          addedIndex++;
        }
        
        i = addedIndex;
      } else {
        // Just deleted lines
        processedLines.push({ old: line });
        i++;
      }
    } else if (line.line_type === 'added') {
      processedLines.push({ new: line });
      i++;
    }
  }

  return (
    <div className={cn("font-mono text-sm overflow-x-auto", className)}>
      <div className="flex">
        {/* Old (left) side */}
        <div className="flex-1 border-r overflow-x-auto">
          {processedLines.map((pair, index) => (
            <div
              key={`old-${index}`}
              className={cn(
                "flex min-h-[1.5rem]",
                pair.old?.line_type === 'deleted' && "bg-red-50 dark:bg-red-950/30",
                pair.old?.line_type === 'context' && "bg-background",
                !pair.old && "bg-muted/20"
              )}
            >
              {showLineNumbers && (
                <span className="px-2 text-muted-foreground text-xs w-12 text-right select-none">
                  {pair.old?.old_line_number || ''}
                </span>
              )}
              {pair.old && (
                <>
                  <span
                    className={cn(
                      "px-2 select-none",
                      pair.old.line_type === 'deleted' && "text-red-600 dark:text-red-400",
                      pair.old.line_type === 'context' && "text-muted-foreground"
                    )}
                  >
                    {pair.old.line_type === 'deleted' ? '-' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre overflow-x-auto">{pair.old.content}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* New (right) side */}
        <div className="flex-1 overflow-x-auto">
          {processedLines.map((pair, index) => (
            <div
              key={`new-${index}`}
              className={cn(
                "flex min-h-[1.5rem]",
                pair.new?.line_type === 'added' && "bg-green-50 dark:bg-green-950/30",
                pair.new?.line_type === 'context' && "bg-background",
                !pair.new && "bg-muted/20"
              )}
            >
              {showLineNumbers && (
                <span className="px-2 text-muted-foreground text-xs w-12 text-right select-none">
                  {pair.new?.new_line_number || ''}
                </span>
              )}
              {pair.new && (
                <>
                  <span
                    className={cn(
                      "px-2 select-none",
                      pair.new.line_type === 'added' && "text-green-600 dark:text-green-400",
                      pair.new.line_type === 'context' && "text-muted-foreground"
                    )}
                  >
                    {pair.new.line_type === 'added' ? '+' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre overflow-x-auto">{pair.new.content}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}