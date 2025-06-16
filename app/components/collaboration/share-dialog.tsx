"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getApiClient } from '@/lib/api';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Clock, Eye, Edit, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareLink {
  id: string;
  token: string;
  permission_level: string;
  expires_at?: string;
  max_uses?: number;
  used_count: number;
  url: string;
}

interface ShareDialogProps {
  documentId: string;
  activeUsers?: number;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const PERMISSION_ICONS = {
  view: Eye,
  edit: Edit,
  admin: Settings,
};

const PERMISSION_LABELS = {
  view: 'View only',
  edit: 'Can edit',
  admin: 'Admin',
};

export function ShareDialog({ documentId, activeUsers = 0, trigger, open, onOpenChange }: ShareDialogProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const api = getApiClient();
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = open !== undefined ? open : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const [permissionLevel, setPermissionLevel] = useState<string>('edit');
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkExpiry, setLinkExpiry] = useState<string>('7d');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  // Load existing share links
  const loadShareLinks = useCallback(async () => {
    try {
      const response = await api.request.request({
        method: 'GET',
        url: `/shares/documents/${documentId}/shares`,
      });
      const data = response as { data: Array<{ id: string; token: string; permission_level: string; expires_at?: string; max_uses?: number; used_count?: number; url?: string }> };
      if (data?.data) {
        const links = data.data.map((share) => ({
          id: share.id,
          token: share.token,
          permission_level: share.permission_level,
          expires_at: share.expires_at,
          max_uses: share.max_uses,
          used_count: share.used_count || 0,
          url: share.url || `${baseUrl}/document/${documentId}?token=${share.token}`
        }));
        setShareLinks(links);
      }
    } catch {
      // Failed to load share links
    }
  }, [api.request, documentId, baseUrl]);

  // Create share link
  const createShareLink = async () => {
    setLoading(true);
    try {
      const requestBody: { permission: string; expires_at?: string } = {
        permission: permissionLevel,
      };

      // Only set expiry if not permanent
      if (linkExpiry !== 'never') {
        const hours = {
          '1h': 1,
          '24h': 24,
          '7d': 24 * 7,
          '30d': 24 * 30,
        }[linkExpiry] || 24 * 7;
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + hours);
        requestBody.expires_at = expiryDate.toISOString();
      }

      const result = await api.request.request({
        method: 'POST',
        url: `/shares/documents/${documentId}/share`,
        body: requestBody,
        mediaType: 'application/json',
      }) as { data: { token: string } };
      
      // Add the share link to the list with full URL
      if (result.data && result.data.token) {
        const shareLink: ShareLink = {
          id: result.data.token, // Use token as id since API doesn't return id
          token: result.data.token,
          permission_level: permissionLevel,
          expires_at: requestBody.expires_at,
          used_count: 0,
          url: `${baseUrl}/document/${documentId}?token=${result.data.token}`
        };
        setShareLinks([...shareLinks, shareLink]);
      }
      
      toast.success('Share link created');
    } catch {
      toast.error('Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Delete share link
  const deleteShareLink = async (token: string) => {
    try {
      await api.request.request({
        method: 'DELETE',
        url: `/shares/${token}`,
      });
      toast.success('Share link deleted');
      setShareLinks(shareLinks.filter(link => link.token !== token));
    } catch {
      toast.error('Failed to delete share link');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadShareLinks();
    }
  }, [isOpen, loadShareLinks]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share Document
          </DialogTitle>
          <DialogDescription>
            Create share links to give others access to this document
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Create link */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={permissionLevel} onValueChange={setPermissionLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View only</SelectItem>
                  <SelectItem value="edit">Can edit</SelectItem>
                </SelectContent>
              </Select>
              <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="never">Never expires</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={createShareLink} disabled={loading} className="flex-1">
                Create Share Link
              </Button>
            </div>
          </div>

          {/* Existing links */}
          <div className="space-y-2">
            <h4 className="font-medium">Active share links</h4>
            {shareLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No share links created yet.</p>
            ) : (
              shareLinks.map((link) => {
                const Icon = PERMISSION_ICONS[link.permission_level as keyof typeof PERMISSION_ICONS] || Eye;
                return (
                  <div key={link.id} className="p-3 border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {PERMISSION_LABELS[link.permission_level as keyof typeof PERMISSION_LABELS]}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {link.expires_at ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Expires {new Date(link.expires_at).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Never expires
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteShareLink(link.token)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input value={link.url} readOnly className="flex-1 font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(link.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Used {link.used_count} times
                      {link.max_uses && ` (max ${link.max_uses})`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-green-600" />
              {activeUsers + 1} user{activeUsers !== 0 ? 's' : ''} active
            </div>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}