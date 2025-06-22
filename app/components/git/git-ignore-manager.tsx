'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Plus,
  Trash2,
  FileX,
  Save,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface GitIgnoreManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDocumentPath?: string;
}

export function GitIgnoreManager({
  open,
  onOpenChange,
  currentDocumentPath,
}: GitIgnoreManagerProps) {
  const [patterns, setPatterns] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState('');
  const [bulkPatterns, setBulkPatterns] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'bulk'>('list');
  const api = getApiClient();

  const fetchPatterns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.gitSync.getGitignorePatterns();
      setPatterns(response.patterns || []);
      setBulkPatterns((response.patterns || []).join('\n'));
    } catch (err) {
      setError('Failed to fetch gitignore patterns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (open) {
      fetchPatterns();
    }
  }, [open, fetchPatterns]);

  const handleAddPattern = useCallback(async () => {
    if (!newPattern.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await api.gitSync.addGitignorePatterns({
        patterns: [newPattern.trim()],
      });
      setNewPattern('');
      await fetchPatterns();
      toast.success('Pattern added successfully');
    } catch (err) {
      setError('Failed to add pattern');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, newPattern, fetchPatterns]);

  const handleRemovePattern = useCallback(async (pattern: string) => {
    try {
      setLoading(true);
      setError(null);
      // Remove the pattern by updating with all patterns except the one to remove
      // For now, we'll need to recreate the gitignore with the new patterns
      // This would require a new endpoint to overwrite patterns
      toast.info(`Pattern "${pattern}" removal requires manual editing of .gitignore file`);
    } catch (err) {
      setError('Failed to remove pattern');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveBulkPatterns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const newPatterns = bulkPatterns
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('#'));
      
      await api.gitSync.addGitignorePatterns({
        patterns: newPatterns,
      });
      
      await fetchPatterns();
      toast.success('Patterns updated successfully');
    } catch (err) {
      setError('Failed to update patterns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, bulkPatterns, fetchPatterns]);

  const handleIgnoreCurrentDocument = useCallback(async () => {
    if (!currentDocumentPath) return;

    try {
      setLoading(true);
      setError(null);
      await api.gitSync.addGitignorePatterns({
        patterns: [currentDocumentPath],
      });
      await fetchPatterns();
      toast.success('Document added to gitignore');
      onOpenChange(false);
    } catch (err) {
      setError('Failed to ignore document');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, currentDocumentPath, fetchPatterns, onOpenChange]);

  const isDocumentIgnored = currentDocumentPath && patterns.includes(currentDocumentPath);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5" />
            Git Ignore Manager
          </DialogTitle>
          <DialogDescription>
            Manage patterns for files and folders to exclude from Git synchronization
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentDocumentPath && (
          <Alert>
            <AlertDescription>
              Current document: <code className="font-mono">{currentDocumentPath}</code>
              {isDocumentIgnored ? (
                <span className="text-muted-foreground"> (already ignored)</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2"
                  onClick={handleIgnoreCurrentDocument}
                  disabled={loading}
                >
                  <FileX className="h-3 w-3 mr-1" />
                  Ignore this document
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('list')}
          >
            List View
          </Button>
          <Button
            variant={mode === 'bulk' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('bulk')}
          >
            Bulk Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPatterns}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {mode === 'list' ? (
          <>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Add pattern (e.g., *.tmp, secret.md, temp/)"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddPattern()}
                disabled={loading}
              />
              <Button
                onClick={handleAddPattern}
                disabled={loading || !newPattern.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              {patterns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No patterns defined yet
                </div>
              ) : (
                <div className="space-y-1">
                  {patterns.map((pattern, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent"
                    >
                      <code className="font-mono text-sm">{pattern}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePattern(pattern)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            <Textarea
              className="h-[300px] font-mono text-sm"
              value={bulkPatterns}
              onChange={(e) => setBulkPatterns(e.target.value)}
              placeholder="Enter patterns, one per line..."
              disabled={loading}
            />
            <div className="text-xs text-muted-foreground">
              Enter one pattern per line. Lines starting with # are comments and will be ignored.
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === 'bulk' && (
            <Button onClick={handleSaveBulkPatterns} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Save Patterns
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}