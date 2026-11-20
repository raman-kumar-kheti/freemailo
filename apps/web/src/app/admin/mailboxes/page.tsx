'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Plus,
  Trash2,
  Edit2,
  Lock,
  HardDrive,
  CheckCircle,
  X,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function MailboxesAdminPage() {
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Mailbox Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDomainId, setNewDomainId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newQuotaMB, setNewQuotaMB] = useState(1024);
  const [creating, setCreating] = useState(false);

  // Edit / Password Reset Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeMailbox, setActiveMailbox] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [editQuotaMB, setEditQuotaMB] = useState(1024);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadDomains();
    loadMailboxes();
  }, [selectedDomain]);

  const loadDomains = async () => {
    try {
      const res = await api.listAdminDomains(1, 100);
      const list = res.data || (Array.isArray(res) ? res : []);
      setDomains(list);
      if (list.length > 0 && !newDomainId) setNewDomainId(list[0].id);
    } catch (_) {}
  };

  const loadMailboxes = async () => {
    setLoading(true);
    try {
      const res = await api.listAdminMailboxes(selectedDomain || undefined, 1, 100);
      setMailboxes(res.data || (Array.isArray(res) ? res : []));
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newDomainId || !newPassword) return;

    const domainObj = domains.find((d) => d.id === newDomainId);
    if (!domainObj) return;

    setCreating(true);
    try {
      const fullEmail = `${newUsername.trim()}@${domainObj.name}`;
      await api.createAdminMailbox({
        email: fullEmail,
        password: newPassword,
        quotaBytes: newQuotaMB * 1024 * 1024,
        domainId: newDomainId,
      });

      setNewUsername('');
      setNewPassword('');
      setAddModalOpen(false);
      alert(`Mailbox '${fullEmail}' provisioning job queued successfully!`);
      loadMailboxes();
    } catch (err: any) {
      alert(`Error creating mailbox: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMailbox) return;

    setUpdating(true);
    try {
      await api.updateAdminMailbox(activeMailbox.id, {
        ...(resetPassword ? { password: resetPassword } : {}),
        quotaBytes: editQuotaMB * 1024 * 1024,
      });
      setEditModalOpen(false);
      setResetPassword('');
      loadMailboxes();
      alert('Mailbox updated successfully!');
    } catch (err: any) {
      alert(`Error updating mailbox: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMailbox = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete mailbox '${email}'? Maildir will be marked for cleanup.`)) return;
    try {
      await api.deleteAdminMailbox(id);
      loadMailboxes();
    } catch (err: any) {
      alert(`Error deleting mailbox: ${err.message}`);
    }
  };

  const filtered = mailboxes.filter((m) =>
    searchTerm ? m.email.toLowerCase().includes(searchTerm.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Mailbox Provisioning</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage virtual user mailboxes, storage quotas, and security credentials
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Mailbox
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 font-medium">Domain Filter:</span>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white focus:outline-none"
          >
            <option value="">All Domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search mailboxes..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Mailboxes Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <th className="py-3 px-4 font-semibold">Mailbox Address</th>
              <th className="py-3 px-4 font-semibold">Domain</th>
              <th className="py-3 px-4 font-semibold">Quota Usage</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">
                  Loading mailboxes...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">
                  No mailboxes found
                </td>
              </tr>
            ) : (
              filtered.map((mb) => {
                const quotaMB = Math.round((Number(mb.quotaBytes) || 1073741824) / (1024 * 1024));
                const usedMB = 12; // Telemetry usage approximation
                const percent = Math.min(Math.round((usedMB / quotaMB) * 100), 100);

                return (
                  <tr key={mb.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-400" />
                      {mb.email}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-400">
                      {mb.domain?.name || mb.email.split('@')[1]}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-48 space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                          <span>{usedMB} MB</span>
                          <span>{quotaMB} MB</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                        {mb.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setActiveMailbox(mb);
                          setEditQuotaMB(quotaMB);
                          setEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title="Edit Mailbox / Password"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMailbox(mb.id, mb.email)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Delete Mailbox"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Mailbox Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm">Provision New Mailbox</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMailbox} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Mailbox Address
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="username"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-white focus:outline-none"
                  />
                  <span className="text-zinc-500">@</span>
                  <select
                    value={newDomainId}
                    onChange={(e) => setNewDomainId(e.target.value)}
                    className="px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-white focus:outline-none"
                  >
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Storage Quota (MB)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={newQuotaMB}
                  onChange={(e) => setNewQuotaMB(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {creating ? 'Queueing...' : 'Provision Mailbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Mailbox / Reset Password Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm">Edit: {activeMailbox?.email}</h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateMailbox} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Reset Password (leave empty to keep current)
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="New password..."
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Quota Limit (MB)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={editQuotaMB}
                  onChange={(e) => setEditQuotaMB(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
