
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

type AuditLog = {
  id: number;
  treeId: number;
  userId: string;
  action: string;
  details: string | null;
  createdAt: string;
  user?: { username: string };
};

export function useAuditLogNotifications(treeId: number | null) {
  useEffect(() => {
    if (!treeId) return;

    const channel = supabase
      .channel(`auditlog:tree:${treeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
          filter: `treeId=eq.${treeId}`,
        },
        (payload) => {
          const log = payload.new as AuditLog;
          // Show a toast notification
          const message = formatNotification(log);
          toast.success(message, {
            duration: 4000,
            position: 'bottom-right',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [treeId]);
}

function formatNotification(log: AuditLog): string {
  // Customize message based on action
  switch (log.action) {
    case 'CREATE_TREE':
      return `🌳 New tree created: ${log.details || ''}`;
    case 'JOIN_TREE':
      return `👤 ${log.user?.username || 'Someone'} joined the tree`;
    case 'CREATE_PERSON':
      return `👤 New family member added: ${log.details || ''}`;
    case 'UPDATE_PERSON':
      return `✏️ A profile was updated`;
    case 'DELETE_PERSON':
      return `🗑️ A profile was removed`;
    default:
      return `📢 ${log.action}: ${log.details || ''}`;
  }
}
