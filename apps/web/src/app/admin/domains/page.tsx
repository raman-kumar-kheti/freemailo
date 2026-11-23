'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  FileCode,
  CheckCircle,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  X,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function DomainsAdminPage() {
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Domain Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [creating, setCreating] = useState(false);

  // DNS Modal
  const [dnsModalOpen, setDnsModalOpen] = useState(false);
  const [activeDnsDomain, setActiveDnsDomain] = useState<any>(null);
  const [dnsData, setDnsData] = useState<any>(null);
  const [loadingDns, setLoadingDns] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const res = await api.listAdminDomains(1, 100);
      setDomains(res.data || (Array.isArray(res) ? res : []));
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    setCreating(true);
    try {
      await api.createAdminDomain(newDomainName.trim().toLowerCase());
      setNewDomainName('');
      setAddModalOpen(false);
      loadDomains();
    } catch (err: any) {
      alert(`Error creating domain: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete domain '${name}'? This will remove all associated mailboxes.`)) return;
    try {
      await api.deleteAdminDomain(id);
      loadDomains();
    } catch (err: any) {
      alert(`Error deleting domain: ${err.message}`);
    }
  };

  const handleOpenDns = async (domain: any) => {
    setActiveDnsDomain(domain);
    setDnsModalOpen(true);
    setLoadingDns(true);
    try {
      const data = await api.getDomainDns(domain.id);
      setDnsData(data);
    } catch (err: any) {
      alert(`Error loading DNS records: ${err.message}`);
    } finally {
      setLoadingDns(false);
    }
  };

  const handleVerifyDns = async () => {
    if (!activeDnsDomain) return;
    try {
      const res = await api.verifyDomainDns(activeDnsDomain.id);
      alert(`DNS verification status: ${JSON.stringify(res)}`);
      loadDomains();
    } catch (err: any) {
      alert(`Error verifying DNS: ${err.message}`);
    }
  };

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Domain Management</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure virtual hosting domains, DKIM keys, and DNS deliverability records
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Domain
        </button>
      </div>

      {/* Domains Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <th className="py-3 px-4 font-semibold">Domain Name</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">DKIM Selector</th>
              <th className="py-3 px-4 font-semibold">Created Date</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">
                  Loading domains...
                </td>
              </tr>
            ) : domains.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">
                  No domains configured yet
                </td>
              </tr>
            ) : (
              domains.map((dom) => (
                <tr key={dom.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    {dom.name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                      ACTIVE
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-zinc-400">
                    {dom.dkimSelector || 'freemailo'}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">
                    {new Date(dom.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenDns(dom)}
                      className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-indigo-300 font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      DNS Setup
                    </button>
                    <button
                      onClick={() => handleDeleteDomain(dom.id, dom.name)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete Domain"
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

      {/* Add Domain Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm">Add Virtual Domain</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDomain} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Domain Name (FQDN)
                </label>
                <input
                  type="text"
                  required
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="e.g. company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-white focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  A 2048-bit RSA DKIM key pair will automatically be generated via BullMQ.
                </p>
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
                  {creating ? 'Creating...' : 'Create Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DNS Records & Deliverability Modal */}
      {dnsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-white">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">
                  DNS Configuration: {activeDnsDomain?.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Publish these exact DNS records with your registrar to ensure 10/10 deliverability
                </p>
              </div>
              <button
                onClick={() => setDnsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              {loadingDns ? (
                <div className="py-12 text-center text-zinc-500">Loading DNS records...</div>
              ) : (
                <>
                  {/* MX Record */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-400">1. MX (Mail Exchange)</span>
                      <button
                        onClick={() => copyToClipboard('mx', dnsData?.mx?.value || `10 mail.${activeDnsDomain?.name}`)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'mx' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'mx' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px] text-zinc-300">
                      <div><span className="text-zinc-500">Type:</span> MX</div>
                      <div><span className="text-zinc-500">Host:</span> @</div>
                      <div><span className="text-zinc-500">Priority:</span> 10</div>
                      <div className="truncate"><span className="text-zinc-500">Value:</span> {dnsData?.mx?.value || `mail.${activeDnsDomain?.name}`}</div>
                    </div>
                  </div>

                  {/* SPF Record */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-400">2. SPF (Sender Policy Framework)</span>
                      <button
                        onClick={() => copyToClipboard('spf', dnsData?.spf?.value || 'v=spf1 mx ~all')}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'spf' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'spf' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px] text-zinc-300">
                      <div><span className="text-zinc-500">Type:</span> TXT</div>
                      <div><span className="text-zinc-500">Host:</span> @</div>
                      <div className="col-span-2 truncate"><span className="text-zinc-500">Value:</span> {dnsData?.spf?.value || 'v=spf1 mx ~all'}</div>
                    </div>
                  </div>

                  {/* DKIM Record */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-400">3. DKIM (DomainKeys Identified Mail)</span>
                      <button
                        onClick={() => copyToClipboard('dkim', dnsData?.dkim?.value || '')}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'dkim' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'dkim' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-zinc-300">
                      <div><span className="text-zinc-500">Type:</span> TXT</div>
                      <div><span className="text-zinc-500">Host:</span> {dnsData?.dkim?.host || `freemailo._domainkey.${activeDnsDomain?.name}`}</div>
                      <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-[10px] break-all">
                        {dnsData?.dkim?.value || 'Loading DKIM public key...'}
                      </div>
                    </div>
                  </div>

                  {/* DMARC Record */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-400">4. DMARC</span>
                      <button
                        onClick={() => copyToClipboard('dmarc', dnsData?.dmarc?.value || `v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:postmaster@${activeDnsDomain?.name}`)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'dmarc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'dmarc' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-zinc-300">
                      <div><span className="text-zinc-500">Type:</span> TXT</div>
                      <div><span className="text-zinc-500">Host:</span> _dmarc.{activeDnsDomain?.name}</div>
                      <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-[10px] break-all">
                        {dnsData?.dmarc?.value || `v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:postmaster@${activeDnsDomain?.name}`}
                      </div>
                    </div>
                  </div>

                  {/* PTR & MTA-STS Guidance */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-indigo-950/20 text-indigo-200 text-xs font-sans space-y-1">
                    <p className="font-bold text-indigo-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      PTR (Reverse DNS) & MTA-STS Recommendations
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Set up a PTR record with your VPS/hosting provider mapping your public IPv4/IPv6 to <code>mail.{activeDnsDomain?.name}</code> to prevent Spamhaus/Gmail rejections.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
              <button
                onClick={handleVerifyDns}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Trigger DNS Verification Check
              </button>
              <button
                onClick={() => setDnsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
