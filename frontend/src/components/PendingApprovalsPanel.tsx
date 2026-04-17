'use client';

/**
 * PendingApprovalsPanel — owner-only slide-in panel.
 * Uses ReactDOM.createPortal so it renders at document.body, escaping
 * any CSS transform stacking context (e.g. the animated sidebar).
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Clock, CheckCircle2, XCircle, Loader2,
    AlertTriangle, Code2, ChevronDown, ChevronUp, User
} from 'lucide-react';
import { getPendingApprovals, approveChange, rejectChange, type PendingApproval } from '@/lib/projectStorage';
import { useAuth } from '@/context/AuthContext';

interface PendingApprovalsPanelProps {
    open: boolean;
    onClose: () => void;
    ownerUid: string;
    projectId: string;
    projectName: string;
    onCountChange?: () => void;
}

export default function PendingApprovalsPanel({
    open, onClose, ownerUid, projectId, projectName, onCountChange,
}: PendingApprovalsPanelProps) {
    const { user } = useAuth();
    const [items, setItems] = useState<PendingApproval[]>([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    const load = async () => {
        setLoading(true);
        const pending = await getPendingApprovals(ownerUid, projectId);
        setItems(pending);
        setLoading(false);
    };

    useEffect(() => {
        if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, ownerUid, projectId]);

    const handleApprove = async (item: PendingApproval) => {
        setBusyId(item.approval_id);
        const result = await approveChange({
            ownerUid, approvalId: item.approval_id,
            connectionString: item.connection_string, sqlPatch: item.sql_patch,
        });
        setBusyId(null);
        if (result.status === 'approved') {
            showToast('success', 'Change approved and applied!');
            setItems(prev => prev.filter(i => i.approval_id !== item.approval_id));
            onCountChange?.();
        } else {
            showToast('error', result.message || 'Failed to approve. Check safety analysis.');
        }
    };

    const handleReject = async (item: PendingApproval) => {
        setBusyId(item.approval_id + '_reject');
        await rejectChange({ ownerUid, approvalId: item.approval_id });
        setBusyId(null);
        showToast('success', 'Change rejected.');
        setItems(prev => prev.filter(i => i.approval_id !== item.approval_id));
        onCountChange?.();
    };

    const formatDate = (s: string | null) => {
        if (!s) return '';
        try { return new Date(s).toLocaleString(); } catch { return s; }
    };

    if (!mounted) return null;

    const content = (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="pap-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 9998,
                            background: 'rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
                        }}
                        onClick={onClose}
                    />

                    {/* Slide-in panel from right */}
                    <motion.div
                        key="pap-panel"
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                        onClick={e => e.stopPropagation()}
                        style={{
                            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9999,
                            width: '100%', maxWidth: 480,
                            display: 'flex', flexDirection: 'column',
                            background: 'linear-gradient(160deg, #0d0d1a 0%, #111128 100%)',
                            borderLeft: '1px solid rgba(255,255,255,0.07)',
                            boxShadow: '-24px 0 80px rgba(0,0,0,0.5)',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}>
                                        <Clock size={17} color="white" strokeWidth={2.5} />
                                    </div>
                                    {items.length > 0 && (
                                        <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', border: '2px solid #0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: 'white' }}>
                                            {items.length}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: 'white' }}>Pending Approvals</h2>
                                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                style={{ padding: 8, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Warning banner */}
                        <div style={{ margin: '16px 20px 0', padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0 }}>
                            <AlertTriangle size={13} color="#fbbf24" style={{ marginTop: 1, flexShrink: 0 }} />
                            <p style={{ margin: 0, fontSize: 11, color: '#fcd34d', lineHeight: 1.6 }}>
                                These are critical schema changes submitted by collaborators. Review the SQL carefully before approving — changes are applied directly to the database.
                            </p>
                        </div>

                        {/* Toast */}
                        <AnimatePresence>
                            {toast && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    style={{
                                        margin: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '12px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                                        background: toast.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                        border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                        color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
                                        flexShrink: 0,
                                    }}
                                >
                                    {toast.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                    {toast.msg}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Scrollable content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {loading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                                    <Loader2 size={26} color="#f59e0b" style={{ animation: 'spin 1s linear infinite' }} />
                                    <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>Loading pending changes…</p>
                                </div>
                            ) : items.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
                                    <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle2 size={26} color="#10b981" />
                                    </div>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#e2e8f0' }}>All clear!</p>
                                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569', textAlign: 'center', maxWidth: 260 }}>
                                        No pending changes requiring your approval right now.
                                    </p>
                                </div>
                            ) : (
                                items.map(item => {
                                    const isExpanded = expandedId === item.approval_id;
                                    const approveBusy = busyId === item.approval_id;
                                    const rejectBusy = busyId === item.approval_id + '_reject';
                                    const anyBusy = approveBusy || rejectBusy;

                                    return (
                                        <motion.div
                                            key={item.approval_id}
                                            layout
                                            style={{
                                                borderRadius: 16, overflow: 'hidden',
                                                border: '1px solid rgba(255,255,255,0.07)',
                                                background: 'rgba(255,255,255,0.03)',
                                            }}
                                        >
                                            {/* Row header */}
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : item.approval_id)}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                                            >
                                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#a78bfa', flexShrink: 0 }}>
                                                    {item.submitted_by_email?.[0]?.toUpperCase() ?? '?'}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <User size={11} color="#475569" />
                                                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.submitted_by_email}</p>
                                                    </div>
                                                    {item.description && (
                                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</p>
                                                    )}
                                                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#334155' }}>{formatDate(item.created_at)}</p>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                                                        Pending
                                                    </span>
                                                    {isExpanded ? <ChevronUp size={13} color="#475569" /> : <ChevronDown size={13} color="#475569" />}
                                                </div>
                                            </button>

                                            {/* Expanded: SQL + actions */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
                                                    >
                                                        {/* SQL block */}
                                                        <div style={{ margin: '14px 14px 0', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(15,15,30,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                                <Code2 size={12} color="#34d399" />
                                                                <span style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SQL Patch</span>
                                                            </div>
                                                            <pre style={{ margin: 0, padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: '#34d399', background: 'rgba(2,6,23,0.6)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', lineHeight: 1.7 }}>
                                                                {item.sql_patch}
                                                            </pre>
                                                        </div>

                                                        {/* Action buttons */}
                                                        <div style={{ display: 'flex', gap: 10, padding: '12px 14px 14px' }}>
                                                            <button
                                                                id={`reject-btn-${item.approval_id}`}
                                                                onClick={() => handleReject(item)}
                                                                disabled={anyBusy}
                                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 12, fontSize: 12, fontWeight: 900, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', cursor: anyBusy ? 'not-allowed' : 'pointer', opacity: anyBusy ? 0.5 : 1, transition: 'all 0.15s' }}
                                                                onMouseEnter={e => { if (!anyBusy) (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                                                            >
                                                                {rejectBusy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
                                                                Reject
                                                            </button>
                                                            <button
                                                                id={`approve-btn-${item.approval_id}`}
                                                                onClick={() => handleApprove(item)}
                                                                disabled={anyBusy}
                                                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 12, fontSize: 12, fontWeight: 900, color: 'white', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', cursor: anyBusy ? 'not-allowed' : 'pointer', opacity: anyBusy ? 0.5 : 1, transition: 'all 0.15s' }}
                                                                onMouseEnter={e => { if (!anyBusy) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
                                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
                                                            >
                                                                {approveBusy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />}
                                                                Approve & Apply
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ flexShrink: 0, padding: '14px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                            <button
                                onClick={onClose}
                                style={{ width: '100%', padding: '11px 0', borderRadius: 12, fontSize: 12, fontWeight: 900, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
}
