"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { toast } from "sonner";
import { GitCommit, AlertCircle, CheckCircle, Loader2, Settings, Eye, ChevronDown, GitPullRequest, History } from "lucide-react";
import { getApiClient } from "@/lib/api";
import type { GitSyncResponse } from "@/lib/api/client";
import { GitConfigDialog } from "./git-config-dialog";
import { ConflictResolutionDialog } from "./conflict-resolution-dialog";
import { GitHistoryDialog } from "./git-history-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface GitSyncButtonProps {
  className?: string;
  onShowDiff?: () => void;
}

export function GitSyncButton({ className, onShowDiff }: GitSyncButtonProps) {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { isMobile } = useSidebar();

  // Fetch Git status
  const { data: gitStatus, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ["git-status"],
    queryFn: () => getApiClient().gitSync.getGitStatus(),
    refetchInterval: 10000, // Refetch every 10 seconds
    retry: false,
  });

  // Fetch Git config
  const { data: gitConfig } = useQuery({
    queryKey: ["git-config"],
    queryFn: () => getApiClient().gitSync.getGitConfig(),
    retry: false,
  });

  // Manual sync mutation
  const syncMutation = useMutation({
    mutationFn: () => getApiClient().gitSync.manualGitSync(),
    onSuccess: (data: GitSyncResponse) => {
      toast.success(`Sync complete: ${data.files_changed} files changed`);
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Sync failed: ${errorMessage}`);
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
    },
  });

  // Initialize repository mutation
  const initMutation = useMutation({
    mutationFn: () => getApiClient().gitSync.initGitRepository(),
    onSuccess: () => {
      toast.success("Git repository initialized");
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Initialization failed: ${errorMessage}`);
    },
  });

  // Pull from remote mutation
  const pullMutation = useMutation({
    mutationFn: () => getApiClient().gitSync.pullFromRemote(),
    onSuccess: (data) => {
      if (data.has_conflicts) {
        toast.warning("Pull completed with conflicts");
        setShowConflicts(true);
      } else {
        toast.success("Pull completed successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Pull failed: ${errorMessage}`);
    },
  });

  const handleSync = () => {
    if (!gitStatus?.repository_initialized) {
      initMutation.mutate();
    } else {
      syncMutation.mutate();
    }
  };

  const handleMainClick = () => {
    if (statusError || !gitConfig) {
      setShowConfig(true);
    } else {
      handleSync();
    }
  };

  const getStatusIcon = () => {
    if (syncMutation.isPending || initMutation.isPending || statusLoading) {
      return <Loader2 className="h-4 w-4 animate-spin shrink-0" />;
    }
    if (statusError || !gitConfig) {
      return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
    }
    if (!gitStatus?.repository_initialized) {
      return <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />;
    }
    
    const hasChanges = (gitStatus.uncommitted_changes || 0) + (gitStatus.untracked_files || 0) > 0;
    if (hasChanges) {
      return <GitCommit className="h-4 w-4 text-orange-500 shrink-0" />;
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
  };

  const getStatusText = () => {
    if (statusLoading) return "Loading...";
    if (statusError || !gitConfig) return "Configuration required";
    if (!gitStatus?.repository_initialized) return "Repository not initialized";
    
    const hasChanges = (gitStatus.uncommitted_changes || 0) + (gitStatus.untracked_files || 0) > 0;
    if (hasChanges) {
      return `${(gitStatus.uncommitted_changes || 0) + (gitStatus.untracked_files || 0)} changes`;
    }
    
    return "Up to date";
  };

  const getTooltipText = () => {
    if (statusError || !gitConfig) return "Git configuration required";
    if (!gitStatus?.repository_initialized) return "Click to initialize repository";
    
    const hasChanges = (gitStatus.uncommitted_changes || 0) + (gitStatus.untracked_files || 0) > 0;
    if (hasChanges) return "Click to sync changes";
    
    return "Repository is up to date";
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                size="lg"
                onClick={handleMainClick}
                disabled={syncMutation.isPending || initMutation.isPending || statusLoading}
                className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex-1 ${className}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getStatusIcon()}
                  
                  <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                    <span className="truncate font-medium">
                      Git Sync
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {getStatusText()}
                    </span>
                  </div>
                  
                </div>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side={isMobile ? "top" : "right"}>
              {getTooltipText()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-48">
            {gitStatus?.repository_initialized && gitConfig && (
              <>
                {onShowDiff && (
                  <DropdownMenuItem 
                    onClick={onShowDiff}
                    disabled={(gitStatus.uncommitted_changes || 0) + (gitStatus.untracked_files || 0) === 0}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Changes
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => pullMutation.mutate()}
                  disabled={pullMutation.isPending || !gitStatus.has_remote}
                >
                  <GitPullRequest className="mr-2 h-4 w-4" />
                  Pull from Remote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowHistory(true)}>
                  <History className="mr-2 h-4 w-4" />
                  View History
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setShowConfig(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <GitConfigDialog
        open={showConfig}
        onOpenChange={setShowConfig}
      />
      
      <ConflictResolutionDialog
        open={showConflicts}
        onOpenChange={setShowConflicts}
        onResolved={() => {
          queryClient.invalidateQueries({ queryKey: ["git-status"] });
        }}
      />
      
      <GitHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
      />
    </>
  );
}