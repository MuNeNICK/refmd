'use client';

import { Badge } from '@/components/ui/badge';
import { Users, Wifi, WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  connected: boolean;
  synced: boolean;
  userCount?: number;
}

export function ConnectionStatus({ connected, synced, userCount = 1 }: ConnectionStatusProps) {
  const otherUsersCount = Math.max(0, userCount - 1);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1">
        {connected ? (
          <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-destructive" />
        )}
        <span className={connected ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
          {connected ? (synced ? 'Synced' : 'Syncing...') : 'Disconnected'}
        </span>
      </div>
      
      {otherUsersCount > 0 && (
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <Badge variant="secondary" className="text-xs">
            {otherUsersCount} {otherUsersCount === 1 ? 'person' : 'people'} editing
          </Badge>
        </div>
      )}
    </div>
  );
}