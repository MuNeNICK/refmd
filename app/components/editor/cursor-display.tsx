'use client';

import React, { useEffect, useState } from 'react';
import { Awareness } from 'y-protocols/awareness';
import { Card } from '@/components/ui/card';

interface CursorInfo {
  clientId: number;
  user: {
    name: string;
    color: string;
    colorLight: string;
  };
  cursor?: {
    anchor: number;
    head: number;
  };
}

interface CursorDisplayProps {
  awareness: Awareness | null;
  className?: string;
}

export function CursorDisplay({ awareness, className }: CursorDisplayProps) {
  const [users, setUsers] = useState<Map<number, CursorInfo>>(new Map());

  useEffect(() => {
    if (!awareness || (awareness as unknown as { _destroyed?: boolean })._destroyed) return;

    const updateUsers = () => {
      const states = awareness.getStates();
      const newUsers = new Map<number, CursorInfo>();
      
      states.forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.user) {
          newUsers.set(clientId, {
            clientId,
            user: state.user,
            cursor: state.cursor
          });
        }
      });
      
      setUsers(newUsers);
    };

    // Initial update
    updateUsers();

    // Listen for awareness updates
    const handler = () => {
      updateUsers();
    };

    awareness.on('update', handler);

    return () => {
      // Check if awareness still exists and hasn't been destroyed
      if (awareness && typeof awareness.off === 'function' && !(awareness as unknown as { _destroyed?: boolean })._destroyed) {
        try {
          awareness.off('update', handler);
        } catch (error) {
          // Ignore errors when removing handlers - awareness might already be destroyed
          if (!(error as Error)?.message?.includes('event handler')) {
            console.error('Error removing awareness handler:', error);
          }
        }
      }
    };
  }, [awareness]);

  if (users.size === 0) {
    return null;
  }

  return (
    <Card className={`absolute top-2 right-2 p-2 ${className}`}>
      <div className="flex flex-col gap-1">
        {Array.from(users.values()).map((user) => (
          <div
            key={user.clientId}
            className="flex items-center gap-2"
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: user.user.color }}
            />
            <span className="text-xs">{user.user.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}