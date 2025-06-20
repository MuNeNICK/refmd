"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
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
import { GitBranch, GitCommit, AlertCircle, CheckCircle, Loader2, Settings } from "lucide-react";
import { getApiClient } from "@/lib/api";
import type { GitSyncResponse } from "@/lib/api/client";
import { GitConfigDialog } from "./git-config-dialog";

interface GitSyncButtonProps {
  className?: string;
}

export function GitSyncButton({ className }: GitSyncButtonProps) {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
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

  const handleSync = () => {
    if (!gitStatus?.repository_initialized) {
      initMutation.mutate();
    } else {
      syncMutation.mutate();
    }
  };

  const handleClick = () => {
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              size="lg"
              onClick={handleClick}
              disabled={syncMutation.isPending || initMutation.isPending || statusLoading}
              className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground ${className}`}
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
                
                {!statusError && gitConfig && gitStatus?.repository_initialized && (
                  <div className="flex items-center gap-1 shrink-0">
                    {gitStatus?.current_branch && (
                      <Badge variant="outline" className="text-xs">
                        <GitBranch className="h-3 w-3 mr-1" />
                        {gitStatus.current_branch}
                      </Badge>
                    )}
                  </div>
                )}
                
                <Settings 
                  className="h-4 w-4 text-muted-foreground shrink-0" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfig(true);
                  }}
                />
              </div>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side={isMobile ? "top" : "right"}>
            {getTooltipText()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <GitConfigDialog
        open={showConfig}
        onOpenChange={setShowConfig}
      />
    </>
  );
}