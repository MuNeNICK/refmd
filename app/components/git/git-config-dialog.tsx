"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getApiClient } from "@/lib/api";
import { CreateGitConfigRequest } from "@/lib/api/client";

interface GitConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  repository_url: string;
  branch_name: string;
  auth_type: CreateGitConfigRequest.auth_type;
  auth_data: {
    token?: string;
    private_key?: string;
  };
  auto_sync: boolean;
}

export function GitConfigDialog({ open, onOpenChange }: GitConfigDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    repository_url: "",
    branch_name: "main",
    auth_type: CreateGitConfigRequest.auth_type.TOKEN,
    auth_data: {},
    auto_sync: true,
  });

  // Fetch existing config
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["git-config"],
    queryFn: () => getApiClient().gitSync.getGitConfig(),
    enabled: open,
    retry: false,
  });

  // Update form when existing config is loaded
  useEffect(() => {
    if (existingConfig) {
      setFormData({
        repository_url: existingConfig.repository_url || "",
        branch_name: existingConfig.branch_name || "main",
        auth_type: existingConfig.auth_type === "ssh" ? CreateGitConfigRequest.auth_type.SSH : CreateGitConfigRequest.auth_type.TOKEN,
        auth_data: {},
        auto_sync: existingConfig.auto_sync ?? true,
      });
    }
  }, [existingConfig]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: (data: CreateGitConfigRequest) =>
      getApiClient().gitSync.createOrUpdateGitConfig(data),
    onSuccess: () => {
      toast.success("Git設定が保存されました");
      queryClient.invalidateQueries({ queryKey: ["git-config"] });
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`設定の保存に失敗しました: ${errorMessage}`);
    },
  });

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: () => getApiClient().gitSync.deleteGitConfig(),
    onSuccess: () => {
      toast.success("Git設定が削除されました");
      queryClient.invalidateQueries({ queryKey: ["git-config"] });
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`設定の削除に失敗しました: ${errorMessage}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.repository_url.trim()) {
      toast.error("リポジトリURLを入力してください");
      return;
    }

    if (formData.auth_type === CreateGitConfigRequest.auth_type.TOKEN && !formData.auth_data.token?.trim()) {
      toast.error("Personal Access Tokenを入力してください");
      return;
    }

    if (formData.auth_type === CreateGitConfigRequest.auth_type.SSH && !formData.auth_data.private_key?.trim()) {
      toast.error("SSH秘密鍵を入力してください");
      return;
    }

    const authData = formData.auth_type === CreateGitConfigRequest.auth_type.TOKEN 
      ? { token: formData.auth_data.token }
      : { private_key: formData.auth_data.private_key };

    saveConfigMutation.mutate({
      repository_url: formData.repository_url.trim(),
      branch_name: formData.branch_name.trim() || "main",
      auth_type: formData.auth_type,
      auth_data: authData,
      auto_sync: formData.auto_sync,
    });
  };

  const handleDelete = () => {
    if (confirm("本当にGit設定を削除しますか？")) {
      deleteConfigMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Git同期設定</DialogTitle>
          <DialogDescription>
            文書をGitリポジトリと同期するための設定を行います。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-4">読み込み中...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repository_url">リポジトリURL *</Label>
              <Input
                id="repository_url"
                type="url"
                placeholder="https://github.com/user/repo.git"
                value={formData.repository_url}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    repository_url: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch_name">ブランチ名</Label>
              <Input
                id="branch_name"
                placeholder="main"
                value={formData.branch_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    branch_name: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth_type">認証方式</Label>
              <Select
                value={formData.auth_type}
                onValueChange={(value: CreateGitConfigRequest.auth_type) =>
                  setFormData((prev) => ({
                    ...prev,
                    auth_type: value,
                    auth_data: {},
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CreateGitConfigRequest.auth_type.TOKEN}>Personal Access Token</SelectItem>
                  <SelectItem value={CreateGitConfigRequest.auth_type.SSH}>SSH Key</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.auth_type === CreateGitConfigRequest.auth_type.TOKEN ? (
              <div className="space-y-2">
                <Label htmlFor="token">Personal Access Token *</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={formData.auth_data.token || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      auth_data: { token: e.target.value },
                    }))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  GitHubの場合: Settings → Developer settings → Personal access tokens → Generate new token
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="private_key">SSH秘密鍵 *</Label>
                <Textarea
                  id="private_key"
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
-----END OPENSSH PRIVATE KEY-----"
                  value={formData.auth_data.private_key || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      auth_data: { private_key: e.target.value },
                    }))
                  }
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  SSH秘密鍵の内容を貼り付けてください。通常は ~/.ssh/id_rsa や ~/.ssh/id_ed25519 ファイルの内容です。
                  <br />
                  注意: 秘密鍵は安全に暗号化されて保存されます。
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto_sync"
                checked={formData.auto_sync}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    auto_sync: e.target.checked,
                  }))
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="auto_sync">文書保存時に自動同期する</Label>
            </div>

            <Alert>
              <AlertDescription>
                認証情報は暗号化されて安全に保存されます。リポジトリには読み書き権限が必要です。
              </AlertDescription>
            </Alert>

            <DialogFooter className="flex justify-between">
              <div>
                {existingConfig && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteConfigMutation.isPending}
                  >
                    {deleteConfigMutation.isPending ? "削除中..." : "設定を削除"}
                  </Button>
                )}
              </div>
              <div className="space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? "保存中..." : "保存"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}