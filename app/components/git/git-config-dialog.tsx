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
      toast.success("Git settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["git-config"] });
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save settings: ${errorMessage}`);
    },
  });

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: () => getApiClient().gitSync.deleteGitConfig(),
    onSuccess: () => {
      toast.success("Git settings deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["git-config"] });
      queryClient.invalidateQueries({ queryKey: ["git-status"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to delete settings: ${errorMessage}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.repository_url.trim()) {
      toast.error("Please enter repository URL");
      return;
    }

    if (formData.auth_type === CreateGitConfigRequest.auth_type.TOKEN && !formData.auth_data.token?.trim()) {
      toast.error("Please enter Personal Access Token");
      return;
    }

    if (formData.auth_type === CreateGitConfigRequest.auth_type.SSH && !formData.auth_data.private_key?.trim()) {
      toast.error("Please enter SSH private key");
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
    if (confirm("Are you sure you want to delete Git settings?")) {
      deleteConfigMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Git Sync Settings</DialogTitle>
          <DialogDescription>
            Configure settings to sync documents with a Git repository.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-4">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repository_url">Repository URL *</Label>
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
              <Label htmlFor="branch_name">Branch name</Label>
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
              <Label htmlFor="auth_type">Authentication method</Label>
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
                  For GitHub: Settings → Developer settings → Personal access tokens → Generate new token
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="private_key">SSH Private Key *</Label>
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
                  Please paste the SSH private key content. Usually the contents of ~/.ssh/id_rsa or ~/.ssh/id_ed25519 file.
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
              <Label htmlFor="auto_sync">Auto-sync when saving documents</Label>
            </div>

            <Alert>
              <AlertDescription>
                Authentication information is encrypted and stored securely. The repository requires read and write permissions.
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
                    {deleteConfigMutation.isPending ? "Deleting..." : "Delete Settings"}
                  </Button>
                )}
              </div>
              <div className="space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}