import type { DiffResult } from '@/lib/api/client';

interface DiffStats {
  additions: number;
  deletions: number;
}

interface SplitViewLine {
  lineNumber?: number;
  content: string;
  type: 'context' | 'added' | 'deleted' | 'empty';
}

interface SplitViewData {
  leftLines: SplitViewLine[];
  rightLines: SplitViewLine[];
}

export function getDiffStats(diff: DiffResult): DiffStats {
  let additions = 0;
  let deletions = 0;
  
  if (diff.diff_lines) {
    diff.diff_lines.forEach(line => {
      if (line.line_type === 'added') additions++;
      else if (line.line_type === 'deleted') deletions++;
    });
  }
  
  return { additions, deletions };
}

export function calculateTotalStats(diffs: DiffResult[]): DiffStats {
  return diffs.reduce(
    (acc, diff) => {
      const stats = getDiffStats(diff);
      return {
        additions: acc.additions + stats.additions,
        deletions: acc.deletions + stats.deletions,
      };
    },
    { additions: 0, deletions: 0 }
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getLineTypeClass(lineType: string | undefined): string {
  switch (lineType) {
    case 'added':
      return 'bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-100';
    case 'deleted':
      return 'bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-100';
    default:
      return '';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getLinePrefix(lineType: string | undefined): string {
  switch (lineType) {
    case 'added':
      return '+';
    case 'deleted':
      return '-';
    default:
      return ' ';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createSplitView(diff: DiffResult): SplitViewData {
  if (!diff.diff_lines) return { leftLines: [], rightLines: [] };
  
  const leftLines: SplitViewLine[] = [];
  const rightLines: SplitViewLine[] = [];
  
  let i = 0;
  while (i < diff.diff_lines.length) {
    const line = diff.diff_lines[i];
    
    if (line.line_type === 'context') {
      leftLines.push({
        lineNumber: line.old_line_number ?? undefined,
        content: line.content || '',
        type: 'context'
      });
      rightLines.push({
        lineNumber: line.new_line_number ?? undefined,
        content: line.content || '',
        type: 'context'
      });
      i++;
    } else if (line.line_type === 'deleted') {
      // Look ahead for matching added lines
      let addedIndex = i + 1;
      while (addedIndex < diff.diff_lines.length && 
             diff.diff_lines[addedIndex].line_type === 'deleted') {
        addedIndex++;
      }
      
      const deletedLines = [];
      const addedLines = [];
      
      // Collect all deleted lines
      let j = i;
      while (j < addedIndex) {
        deletedLines.push(diff.diff_lines[j]);
        j++;
      }
      
      // Collect all added lines
      while (addedIndex < diff.diff_lines.length && 
             diff.diff_lines[addedIndex].line_type === 'added') {
        addedLines.push(diff.diff_lines[addedIndex]);
        addedIndex++;
      }
      
      // Pair up deleted and added lines
      const maxLength = Math.max(deletedLines.length, addedLines.length);
      for (let k = 0; k < maxLength; k++) {
        if (k < deletedLines.length) {
          leftLines.push({
            lineNumber: deletedLines[k].old_line_number ?? undefined,
            content: deletedLines[k].content || '',
            type: 'deleted'
          });
        } else {
          leftLines.push({ content: '', type: 'empty' });
        }
        
        if (k < addedLines.length) {
          rightLines.push({
            lineNumber: addedLines[k].new_line_number ?? undefined,
            content: addedLines[k].content || '',
            type: 'added'
          });
        } else {
          rightLines.push({ content: '', type: 'empty' });
        }
      }
      
      i = addedIndex;
    } else if (line.line_type === 'added') {
      // Standalone added line (no corresponding deletion)
      leftLines.push({ content: '', type: 'empty' });
      rightLines.push({
        lineNumber: line.new_line_number ?? undefined,
        content: line.content || '',
        type: 'added'
      });
      i++;
    } else {
      i++;
    }
  }
  
  return { leftLines, rightLines };
}

// Diff line color constants
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DIFF_COLORS = {
  added: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-900 dark:text-green-100'
  },
  deleted: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-900 dark:text-red-100'
  },
  empty: {
    bg: 'bg-gray-50 dark:bg-gray-950/30'
  }
} as const;