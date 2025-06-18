'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StickyNote } from 'lucide-react';

interface CreateScrapDialogProps {
  onCreateScrap: (title: string) => Promise<void>;
  parentId?: string;
  trigger?: React.ReactNode;
}

export function CreateScrapDialog({ 
  onCreateScrap, 
  parentId,
  trigger 
}: CreateScrapDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      await onCreateScrap(title.trim());
      setTitle('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to create scrap:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <StickyNote className="h-4 w-4 mr-2" />
            新規スクラップ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新規スクラップ作成</DialogTitle>
          <DialogDescription>
            スクラップはスレッド形式でメモや知見を記録できる機能です
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              タイトル
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="col-span-3"
              placeholder="スクラップのタイトル"
              disabled={isLoading}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? '作成中...' : '作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}