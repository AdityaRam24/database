'use client';

/**
 * CollaborateModal — admin-only modal for managing project collaborators.
 * Uses ReactDOM.createPortal so it renders at document.body, escaping
 * any CSS transform stacking context (e.g. the animated sidebar).
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Trash2, Loader2, Mail, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { inviteCollaborator, getProjectMembers, removeCollaborator } from '@/lib/projectStorage';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';

interface Member {
    invite_id: string;
    invited_email: string;
}

interface CollaborateModalProps {
    open: boolean;
    onClose: () => void;
    project: {
        id?: string;
        projectName: string;
        connectionString: string;
        connectionType: string;
    };
}

export default function CollaborateModal({ open, onClose, project }: CollaborateModalProps) {
    const { user } = useAuth();
    const [email, setEmail] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme } = useTheme();

    const isDark = resolvedTheme === 'dark';
    const uiTheme = {
        bg: isDark ? 'linear-gradient(145deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)' : '#ffffff',
        border: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        textBright: isDark ? 'white' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        textSubtle: isDark ? '#cbd5e1' : '#334155',
        iconBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        iconBgHover: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
        inputBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
        inputFocusShadow: isDark ? '0 0 0 3px rgba(124,58,237,0.15)' : '0 0 0 3px rgba(99,102,241,0.15)',
        listBg: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
        listBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        shadow: isDark ? '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)' : '0 24px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
        buttonBg: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
        buttonBgHover: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        buttonBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    };

    // Portal target — must be client-only
    useEffect(() => { setMounted(true); }, []);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const loadMembers = async () => {
        if (!user || !project.id) return;
        setLoading(true);
        const result = await getProjectMembers(user.uid, project.id);
        setMembers(result);
        setLoading(false);
    };

    useEffect(() => {
        if (open) {
            setEmail('');
            setToast(null);
            loadMembers();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, project.id]);

    const handleInvite = async () => {
        if (!email.trim() || !user || !project.id) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            showToast('error', 'Please enter a valid email address.');
            return;
        }
        if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
            showToast('error', "You can't invite yourself.");
            return;
        }
        setInviting(true);
        const result = await inviteCollaborator({
            ownerUid:         user.uid,
            projectId:        project.id,
            projectName:      project.projectName,
            connectionString: project.connectionString,
            connectionType:   project.connectionType,
            invitedEmail:     email.trim(),
        });
        setInviting(false);
        if (result.status === 'invited') {
            showToast('success', `Invitation sent to ${email.trim()}`);
            setEmail('');
            loadMembers();
        } else if (result.status === 'already_invited') {
            showToast('error', 'This user is already a collaborator.');
        } else {
            showToast('error', 'Failed to send invitation. Try again.');
        }
    };

    const handleRemove = async (member: Member) => {
        if (!user || !project.id) return;
        await removeCollaborator({
            ownerUid:  user.uid,
            projectId: project.id,
            inviteId:  member.invite_id,
        });
        setMembers(prev => prev.filter(m => m.invite_id !== member.invite_id));
        showToast('success', `Removed ${member.invited_email}`);
    };

    // Don't render on server
    if (!mounted) return null;

    const content = (
        <AnimatePresence>
            {open && (
                <>
                    {/* ── Full-screen backdrop ─────────────────────────────── */}
                    <motion.div
                        key="cm-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 9998,
                            background: 'rgba(0,0,0,0.65)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                        }}
                        onClick={onClose}
                    />

                    {/* ── Centered modal ───────────────────────────────────── */}
                    <motion.div
                        key="cm-modal"
                        initial={{ opacity: 0, scale: 0.90, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.90, y: 24 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px',
                            pointerEvents: 'none',
                        }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{
                                pointerEvents: 'auto',
                                width: '100%',
                                maxWidth: '440px',
                                borderRadius: '20px',
                                boxShadow: uiTheme.shadow,
                                overflow: 'hidden',
                                background: uiTheme.bg,
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 18px', borderBottom: `1px solid ${uiTheme.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: 38, height: 38, borderRadius: 12,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isDark ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'linear-gradient(135deg, #3b82f6, #4f46e5)',
                                        boxShadow: isDark ? '0 4px 16px rgba(124,58,237,0.45)' : '0 4px 14px 0 rgba(79, 70, 229, 0.39)',
                                    }}>
                                        <Users size={17} color="white" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: uiTheme.textBright, lineHeight: 1.2 }}>
                                            Manage Collaborators
                                        </h2>
                                        <p style={{ margin: 0, fontSize: 11, color: uiTheme.textMuted, fontWeight: 500, marginTop: 2, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {project.projectName}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    style={{ padding: '8px', borderRadius: 12, background: uiTheme.iconBg, border: 'none', cursor: 'pointer', color: uiTheme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = uiTheme.iconBgHover; (e.currentTarget as HTMLElement).style.color = uiTheme.textBright; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = uiTheme.iconBg; (e.currentTarget as HTMLElement).style.color = uiTheme.textMuted; }}
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Toast */}
                            <AnimatePresence>
                                {toast && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        style={{
                                            margin: '16px 20px 0',
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '12px 16px', borderRadius: 12,
                                            fontSize: 12, fontWeight: 700,
                                            background: toast.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
                                        }}
                                    >
                                        {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                        {toast.msg}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Body */}
                            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Invite input */}
                                <div>
                                    <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                                        Invite by Email
                                    </label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                                            <input
                                                id="collab-email-input"
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                                                placeholder="colleague@example.com"
                                                style={{
                                                    width: '100%', boxSizing: 'border-box',
                                                    paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                                                    borderRadius: 12, fontSize: 13, fontWeight: 500,
                                                    color: uiTheme.textBright, background: uiTheme.inputBg,
                                                    border: `1px solid ${uiTheme.inputBorder}`,
                                                    outline: 'none', fontFamily: 'inherit',
                                                }}
                                                onFocus={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(124,58,237,0.6)' : 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = uiTheme.inputFocusShadow; }}
                                                onBlur={e => { e.currentTarget.style.borderColor = uiTheme.inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
                                            />
                                        </div>
                                        <button
                                            id="collab-invite-btn"
                                            onClick={handleInvite}
                                            disabled={inviting || !email.trim()}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '10px 18px', borderRadius: 12,
                                                fontSize: 12, fontWeight: 900, 
                                                color: resolvedTheme === 'dark' ? 'white' : '#ffffff',
                                                background: resolvedTheme === 'dark' 
                                                    ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                                                    : 'linear-gradient(135deg, #3b82f6, #4f46e5)',
                                                border: 'none', cursor: inviting || !email.trim() ? 'not-allowed' : 'pointer',
                                                opacity: inviting || !email.trim() ? 0.5 : 1,
                                                boxShadow: resolvedTheme === 'light' ? '0 4px 14px 0 rgba(79, 70, 229, 0.39)' : 'none',
                                                transition: 'all 0.15s', whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {inviting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={13} />}
                                            Invite
                                        </button>
                                    </div>
                                    <p style={{ margin: '8px 0 0 4px', fontSize: 11, color: uiTheme.textMuted }}>
                                        Collaborators can view & query this project. Critical schema changes need your approval.
                                    </p>
                                </div>

                                {/* Members list */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            Current Collaborators
                                        </label>
                                        {loading && <Loader2 size={12} style={{ color: uiTheme.textMuted, animation: 'spin 1s linear infinite' }} />}
                                    </div>

                                    {!loading && members.length === 0 ? (
                                        <div style={{ padding: '28px 0', textAlign: 'center' }}>
                                            <Users size={28} style={{ color: uiTheme.textSubtle, margin: '0 auto 10px' }} />
                                            <p style={{ margin: 0, fontSize: 13, color: uiTheme.textMuted, fontWeight: 600 }}>No collaborators yet</p>
                                            <p style={{ margin: '4px 0 0', fontSize: 11, color: uiTheme.textSubtle }}>Invite someone above to get started</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                                            {members.map(m => (
                                                <div
                                                    key={m.invite_id}
                                                    className="group"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: uiTheme.listBg, border: `1px solid ${uiTheme.listBorder}` }}
                                                >
                                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: isDark ? 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.2))' : 'linear-gradient(135deg,rgba(59,130,246,0.1),rgba(79,70,229,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: isDark ? '#a78bfa' : '#4f46e5', flexShrink: 0 }}>
                                                        {m.invited_email[0].toUpperCase()}
                                                    </div>
                                                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: uiTheme.textSubtle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.invited_email}</span>
                                                    <span style={{ fontSize: 9, fontWeight: 900, color: isDark ? '#a78bfa' : '#4f46e5', background: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(79,70,229,0.1)', padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                                                        Collaborator
                                                    </span>
                                                    <button
                                                        onClick={() => handleRemove(m)}
                                                        title="Remove"
                                                        style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', transition: 'all 0.15s', flexShrink: 0 }}
                                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${uiTheme.border}`, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={onClose}
                                    style={{ padding: '9px 22px', borderRadius: 12, fontSize: 12, fontWeight: 900, color: uiTheme.textSubtle, background: uiTheme.buttonBg, border: `1px solid ${uiTheme.buttonBorder}`, cursor: 'pointer', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = uiTheme.buttonBgHover; (e.currentTarget as HTMLElement).style.color = uiTheme.textBright; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = uiTheme.buttonBg; (e.currentTarget as HTMLElement).style.color = uiTheme.textSubtle; }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
}
