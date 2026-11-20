'use client';

import React, { useState, useEffect } from 'react';
import { Forward, Plus, Trash2, Globe, X } from 'lucide-react';
import { api } from '@/lib/api';

export default function AliasesAdminPage() {
  const [aliases, setAliases] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Alias Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sourceUsername, setSourceUsername] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [destinationEmail, setDestinationEmail] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDomains();
    loadAliases();
  }, []);

  const loadDomains = async () => {
    try {
      const res = await api.listAdminDomains(1, 100);
      const list = res.data || (Array.isArray(res) ? res : []);
      setDomains(list);
      if (list.length > 0 && !selectedDomainId) setSelectedDomainId(list[0].id);
    } catch (_) {}
  };

  const loadAliases = async () => {
    setLoading(true);
    try {
      const res = await api.listAdminAliases();
      setAliases(res.data || (Array.isArray(res) ? res : []));
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUsername.trim() || !selectedDomainId || !destinationEmail.trim()) return;

    const domainObj = domains.find((d) => d.id === selectedDomainId);
    if (!domainObj) return;

    setCreating(true);
    try {
      const fullSource = `${sourceUsername.trim()}@${domainObj.name}`;
      await api.createAdminAlias(fullSource, destinationEmail.trim(), selectedDomainId);
      setSourceUsername('');
      setDestinationEmail('');
      setAddModalOpen(false);
      loadAliases();
    } catch (err: any) {
      alert(`Error creating alias: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAlias = async (id: string, source: string) => {
    if (!confirm(`Delete alias '${source}'?`)) return;
    try {
      await api.deleteAdminAlias(id);
      loadAliases();
    } catch (err: any) {
      alert(`Error deleting alias: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Aliases & Forwarding</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Map incoming addresses to hosted mailbox destinations
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Alias
        </button>
      </div>

      {/* Aliases Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <th className="py-3 px-4 font-semibold">Source Address</th>
              <th className="py-3 px-4 font-semibold">Forward Destination</th>
              <th className="py-3 px-4 font-semibold">Created Date</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-500">
                  Loading aliases...
                </td>
              </tr>
            ) : aliases.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-500">
                  No aliases configured
                </td>
              </tr>
            ) : (
              aliases.map((al) => (
                <tr key={al.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                    <Forward className="w-4 h-4 text-emerald-400" />
                    {al.source}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-300">
                    &rarr; {al.destination}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">
                    {new Date(al.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDeleteAlias(al.id, al.source)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete Alias"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Alias Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm">Create Email Alias</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAlias} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Source Address
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={sourceUsername}
                    onChange={(e) => setSourceUsername(e.target.value)}
                    placeholder="e.g. sales"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-white focus:outline-none"
                  />
                  <span className="text-zinc-500">@</span>
                  <select
                    value={selectedDomainId}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
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
                  Forward Destination Address
                </label>
                <input
                  type="email"
                  required
                  value={destinationEmail}
                  onChange={(e) => setDestinationEmail(e.target.value)}
                  placeholder="e.g. alice@example.test"
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
                  {creating ? 'Creating...' : 'Create Alias'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
