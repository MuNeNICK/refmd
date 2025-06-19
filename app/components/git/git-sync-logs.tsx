"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, GitCommit, GitBranch, Clock } from "lucide-react";
import { getApiClient } from "@/lib/api";

interface GitSyncLogsProps {
  className?: string;
}

export function GitSyncLogs({ className }: GitSyncLogsProps) {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["git-sync-logs"],
    queryFn: () => getApiClient().gitSync.getGitSyncLogs(),
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: false,
  });

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "init":
        return <GitBranch className="h-4 w-4" />;
      case "commit":
        return <GitCommit className="h-4 w-4" />;
      case "push":
      case "pull":
        return <GitCommit className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case "init":
        return "初期化";
      case "commit":
        return "コミット";
      case "push":
        return "プッシュ";
      case "pull":
        return "プル";
      default:
        return operation;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "success") {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          成功
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          失敗
        </Badge>
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Git同期ログ
          </CardTitle>
          <CardDescription>
            ログの取得に失敗しました。Git設定を確認してください。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Git同期ログ
        </CardTitle>
        <CardDescription>
          最新の同期操作の履歴を表示します
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">読み込み中...</div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            同期ログがありません
          </div>
        ) : (
          <ScrollArea className="h-[300px] w-full">
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getOperationIcon(log.operation || "unknown")}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {getOperationLabel(log.operation || "unknown")}
                      </span>
                      {getStatusBadge(log.status || "unknown")}
                    </div>
                    
                    {log.message && (
                      <p className="text-sm text-muted-foreground mb-1">
                        {log.message}
                      </p>
                    )}
                    
                    {log.commit_hash && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GitCommit className="h-3 w-3" />
                        <code className="bg-muted px-1 rounded">
                          {log.commit_hash.substring(0, 8)}
                        </code>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Clock className="h-3 w-3" />
                      {formatDate(log.created_at || "")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}