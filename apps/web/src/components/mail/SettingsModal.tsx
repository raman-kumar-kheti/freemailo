'use client';

import React, { useState, useEffect } from 'react';
import { X, User, PenTool, Tag, Shield, Plus, Trash2, Check } from 'lucide-react';
import { api, User as UserType } from '@/lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onProfileUpdated: () => void;
}

export function SettingsModal({ isOpen, onClose, user, onProfileUpdated }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'signatures' | 'labels' | 'trusted'>('profile');

  // Profile state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Signatures state
  const [signatures, setSignatures] = useState<any[]>([]);
  const [newSigName, setNewSigName] = useState('');
  const [newSigBody, setNewSigBody] = useState('');
  const [newSigDefault, setNewSigDefault] = useState(false);

  // Labels state
  const [labels, setLabels] = useState<any[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');

  // Trusted senders
  const [trustedSenders, setTrustedSenders] = useState<any[]>([]);
  const [newSenderEmail, setNewSenderEmail] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    loadSignatures();
    loadLabels();
    loadTrustedSenders();
  }, [isOpen]);

  const loadSignatures = async () => {
    try {
      const data = await api.getSignatures();
      setSignatures(data.signatures || []);
    } catch (_) {}
  };

  const loadLabels = async () => {
    try {
      const data = await api.getLabels();
      setLabels(data.labels || []);
    } catch (_) {}
  };

  const loadTrustedSenders = async () => {
    try {
      const data = await api.getTrustedSenders();
      setTrustedSenders(data.senders || []);
    } catch (_) {}
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.updateProfile(displayName);
      onProfileUpdated();
      alert('Profile updated successfully!');
    } catch (err: any) {
      alert(`Error updating profile: ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSigName.trim() || !newSigBody.trim()) return;
    try {
      await api.createSignature(newSigName, newSigBody, newSigDefault);
      setNewSigName('');
      setNewSigBody('');
      setNewSigDefault(false);
      loadSignatures();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteSignature = async (id: string) => {
    try {
      await api.deleteSignature(id);
      loadSignatures();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    try {
      await api.createLabel(newLabelName, newLabelColor);
      setNewLabelName('');
      loadLabels();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteLabel = async (id: string) => {
    try {
      await api.deleteLabel(id);
      loadLabels();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddTrustedSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim()) return;
    try {
      await api.addTrustedSender(newSenderEmail.trim());
      setNewSenderEmail('');
      loadTrustedSenders();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-popover border border-border rounded-2xl shadow-2xl max-w-2xl w-full h-[580px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-base text-foreground">MailHive Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-border flex gap-4 text-xs font-semibold">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'signatures', label: 'Signatures', icon: PenTool },
            { id: 'labels', label: 'Labels', icon: Tag },
            { id: 'trusted', label: 'Trusted Senders', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="p-6 flex-1 overflow-y-auto text-sm">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <input
                  type="text"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-muted-foreground text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary focus:outline-none text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          )}

          {/* SIGNATURES TAB */}
          {activeTab === 'signatures' && (
            <div className="space-y-6">
              <form onSubmit={handleAddSignature} className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
                <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">Create New Signature</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newSigName}
                    onChange={(e) => setNewSigName(e.target.value)}
                    placeholder="Signature Name (e.g. Work)"
                    className="px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSigDefault}
                      onChange={(e) => setNewSigDefault(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    <span>Set as default signature</span>
                  </label>
                </div>
                <textarea
                  value={newSigBody}
                  onChange={(e) => setNewSigBody(e.target.value)}
                  placeholder="HTML or text signature body..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs h-20 resize-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
                >
                  Add Signature
                </button>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Existing Signatures</h4>
                {signatures.map((sig) => (
                  <div key={sig.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                    <div>
                      <span className="font-semibold text-xs text-foreground">{sig.name}</span>
                      {sig.isDefault && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[10px] font-bold">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSignature(sig.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Delete signature"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LABELS TAB */}
          {activeTab === 'labels' && (
            <div className="space-y-6">
              <form onSubmit={handleAddLabel} className="p-4 rounded-xl border border-border bg-secondary/30 flex items-center gap-3">
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="New label name..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
                />
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-8 h-8 rounded border-0 cursor-pointer p-0"
                  title="Choose color"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
                >
                  Create Label
                </button>
              </form>

              <div className="space-y-2">
                {labels.map((lbl) => (
                  <div key={lbl.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lbl.color || '#3b82f6' }} />
                      <span className="text-xs font-semibold text-foreground">{lbl.name}</span>
                    </div>
                    {!lbl.isSystem && (
                      <button
                        onClick={() => handleDeleteLabel(lbl.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Delete label"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRUSTED SENDERS TAB */}
          {activeTab === 'trusted' && (
            <div className="space-y-6">
              <form onSubmit={handleAddTrustedSender} className="p-4 rounded-xl border border-border bg-secondary/30 flex items-center gap-3">
                <input
                  type="email"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  placeholder="sender@domain.com"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
                >
                  Trust Sender
                </button>
              </form>

              <div className="space-y-2">
                {trustedSenders.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                    <span className="text-xs font-mono text-foreground">{s.email}</span>
                  </div>
                ))}
                {trustedSenders.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No trusted senders added yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
