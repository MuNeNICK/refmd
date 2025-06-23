'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  FileText,
  GitMerge,
  X,
  Check,
  ChevronRight,
} from 'lucide-react';
import type { ConflictInfo, ConflictedFile } from '@/lib/api/client';
import { MergeResolution } from '@/lib/api/client';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  onResolved,
}: ConflictResolutionDialogProps) {
  const [conflicts, setConflicts] = useState<ConflictInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<ConflictedFile | null>(null);
  const [resolutionType, setResolutionType] = useState<MergeResolution.resolution_type>(MergeResolution.resolution_type.USE_OURS);
  const [manualContent, setManualContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = getApiClient();

  const fetchConflicts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const conflictData = await api.gitSync.getConflicts();
      setConflicts(conflictData);
      if (conflictData.conflicted_files && conflictData.conflicted_files.length > 0) {
        setSelectedFile(conflictData.conflicted_files[0]);
      }
    } catch (err) {
      setError('Failed to fetch conflicts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (open) {
      fetchConflicts();
    }
  }, [open, fetchConflicts]);

  const handleResolveConflict = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      setError(null);

      const resolution: MergeResolution = {
        file_path: selectedFile.file_path || '',
        resolution_type: resolutionType,
        resolved_content: resolutionType === MergeResolution.resolution_type.MANUAL ? manualContent : undefined,
      };

      await api.gitSync.resolveConflict(resolution);

      // Refresh conflicts
      await fetchConflicts();

      // If no more conflicts, close dialog
      if (conflicts && conflicts.conflicted_files && conflicts.conflicted_files.length === 1) {
        onOpenChange(false);
        onResolved?.();
      }
    } catch (err) {
      setError('Failed to resolve conflict');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, conflicts, fetchConflicts, onOpenChange, onResolved, resolutionType, manualContent, selectedFile]);

  const handleAbortMerge = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await api.gitSync.abortMerge();
      onOpenChange(false);
      onResolved?.();
    } catch (err) {
      setError('Failed to abort merge');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [api, onOpenChange, onResolved]);

  const getConflictTypeLabel = (type: string) => {
    switch (type) {
      case 'both_modified':
        return 'Both Modified';
      case 'both_added':
        return 'Both Added';
      case 'deleted_by_us':
        return 'Deleted by Us';
      case 'deleted_by_them':
        return 'Deleted by Them';
      default:
        return 'Unknown';
    }
  };

  const renderConflictMarkers = (file: ConflictedFile) => {
    if (!file.markers || file.markers.length === 0) {
      return null;
    }

    return (
      <div className="space-y-4">
        {file.markers.map((marker, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">
              Conflict {index + 1} (Lines {(marker.start_line || 0) + 1} - {(marker.end_line || 0) + 1})
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-2">Our Version</div>
                <pre className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-sm overflow-x-auto">
                  {(marker.our_content || []).join('\n')}
                </pre>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Their Version</div>
                <pre className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-sm overflow-x-auto">
                  {(marker.their_content || []).join('\n')}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Resolve Merge Conflicts
          </DialogTitle>
          <DialogDescription>
            {conflicts && conflicts.conflicted_files && conflicts.conflicted_files.length > 0
              ? `${conflicts.conflicted_files.length} file(s) have conflicts that need to be resolved`
              : 'No conflicts to resolve'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {conflicts && conflicts.conflicted_files && conflicts.conflicted_files.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {/* File list */}
            <div className="col-span-1 border-r pr-4">
              <h3 className="text-sm font-medium mb-2">Conflicted Files</h3>
              <ScrollArea className="h-[400px]">
                <div className="space-y-1">
                  {conflicts.conflicted_files.map((file) => (
                    <button
                      key={file.file_path || ''}
                      onClick={() => {
                        setSelectedFile(file);
                        setResolutionType(MergeResolution.resolution_type.USE_OURS);
                        setManualContent('');
                      }}
                      className={`w-full text-left p-2 rounded-md hover:bg-accent transition-colors ${
                        selectedFile?.file_path === file.file_path ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate">{file.file_path || 'Unknown file'}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      </div>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {getConflictTypeLabel(file.conflict_type || 'unknown')}
                      </Badge>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Conflict details */}
            <div className="col-span-3">
              {selectedFile && (
                <>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Resolution Method</h3>
                    <Select
                      value={resolutionType}
                      onValueChange={(value) => setResolutionType(value as MergeResolution.resolution_type)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MergeResolution.resolution_type.USE_OURS}>Use Our Version</SelectItem>
                        <SelectItem value={MergeResolution.resolution_type.USE_THEIRS}>Use Their Version</SelectItem>
                        <SelectItem value={MergeResolution.resolution_type.MANUAL}>Manual Resolution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Tabs defaultValue="preview" className="h-[350px]">
                    <TabsList>
                      <TabsTrigger value="preview">Conflict Preview</TabsTrigger>
                      <TabsTrigger value="ours">Our Version</TabsTrigger>
                      <TabsTrigger value="theirs">Their Version</TabsTrigger>
                      {selectedFile.base_version && (
                        <TabsTrigger value="base">Base Version</TabsTrigger>
                      )}
                      {resolutionType === MergeResolution.resolution_type.MANUAL && (
                        <TabsTrigger value="manual">Manual Edit</TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="preview" className="h-[300px] overflow-auto">
                      {renderConflictMarkers(selectedFile)}
                    </TabsContent>

                    <TabsContent value="ours" className="h-[300px]">
                      <ScrollArea className="h-full">
                        <pre className="p-4 text-sm">
                          {selectedFile.our_version || 'No content (file deleted)'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="theirs" className="h-[300px]">
                      <ScrollArea className="h-full">
                        <pre className="p-4 text-sm">
                          {selectedFile.their_version || 'No content (file deleted)'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    {selectedFile.base_version && (
                      <TabsContent value="base" className="h-[300px]">
                        <ScrollArea className="h-full">
                          <pre className="p-4 text-sm">{selectedFile.base_version}</pre>
                        </ScrollArea>
                      </TabsContent>
                    )}

                    {resolutionType === MergeResolution.resolution_type.MANUAL && (
                      <TabsContent value="manual" className="h-[300px]">
                        <Textarea
                          className="h-full font-mono text-sm"
                          value={manualContent}
                          onChange={(e) => setManualContent(e.target.value)}
                          placeholder="Enter your resolved content here..."
                        />
                      </TabsContent>
                    )}
                  </Tabs>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-4">
          <Button variant="destructive" onClick={handleAbortMerge} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Abort Merge
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            {selectedFile && (
              <Button onClick={handleResolveConflict} disabled={loading}>
                <Check className="h-4 w-4 mr-2" />
                Resolve Conflict
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}