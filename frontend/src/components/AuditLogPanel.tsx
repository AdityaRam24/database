'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, Database, User, Clock, AlertCircle } from 'lucide-react';
import { getAuditLogs, AuditLog } from '@/lib/projectStorage';
import { Button } from '@/components/ui/button';

interface AuditLogPanelProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditLogPanel({ projectId, projectName, isOpen, onClose }: AuditLogPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && projectId) {
      setLoading(true);
      getAuditLogs(projectId).then(data => {
        setLogs(data);
        setLoading(false);
      });
    }
  }, [isOpen, projectId]);

  // Don't render until client-side hydration is complete
  if (!mounted) return null;

  const getActionColor = (action: string) => {
    if (action.includes('APPROVED')) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10';
    if (action.includes('REJECTED')) return 'text-red-500 bg-red-50 dark:bg-red-500/10';
    if (action.includes('SUBMITTED')) return 'text-blue-500 bg-blue-50 dark:bg-blue-500/10';
    if (action.includes('ACCEPTED')) return 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10';
    if (action.includes('INVITE')) return 'text-violet-500 bg-violet-50 dark:bg-violet-500/10';
    return 'text-slate-500 bg-slate-50 dark:bg-slate-500/10';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('REJECTED')) return <X size={14} className="text-red-500" />;
    if (action.includes('APPROVED')) return <Database size={14} className="text-emerald-500" />;
    return <History size={14} className={getActionColor(action).split(' ')[0]} />;
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] z-[9998]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-white dark:bg-[#0f172a] shadow-2xl z-[9999] border-l border-black/5 dark:border-white/5 flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-black/5 dark:border-white/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-500">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Audit Log
                  </h2>
                  <p className="text-xs text-slate-500">
                    Activity history for <span className="font-medium text-violet-500">{projectName}</span>
                  </p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
                <X size={18} className="text-slate-500" />
              </Button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <History size={40} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium text-slate-500">No activity yet</p>
                  <p className="text-xs mt-1">Changes and invites will appear here.</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.log_id} className="relative pl-6 pb-4 border-l border-slate-200 dark:border-slate-800 last:border-transparent last:pb-0">
                    <div className="absolute left-[-9px] top-0 p-1 rounded-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700">
                      {getActionIcon(log.action)}
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-black/5 dark:border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getActionColor(log.action)}`}>
                          {log.action.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                          <Clock size={10} />
                          {new Date(log.created_at).toLocaleString(undefined, { 
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </div>
                      </div>
                      
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                        {log.details}
                      </p>
                      
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500 font-medium">
                        <User size={10} />
                        {log.user_email}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
