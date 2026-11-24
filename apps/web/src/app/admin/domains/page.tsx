"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/mail-ui";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";

export default function DomainsAdminPage() {
  const { notify, confirmAction, feedback } = useAdminFeedback();
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Domain Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
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
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) return;
    setCreating(true);
    try {
      await api.createAdminDomain(newDomainName.trim().toLowerCase());
      setNewDomainName("");
      setAddModalOpen(false);
      loadDomains();
    } catch (err: any) {
      notify(`Error creating domain: ${err.message}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (
      !(await confirmAction(
        `Are you sure you want to delete domain '${name}'? This will remove all associated mailboxes.`,
      ))
    )
      return;
    try {
      await api.deleteAdminDomain(id);
      loadDomains();
    } catch (err: any) {
      notify(`Error deleting domain: ${err.message}`, "error");
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
      notify(`Error loading DNS records: ${err.message}`, "error");
    } finally {
      setLoadingDns(false);
    }
  };

  const handleVerifyDns = async () => {
    if (!activeDnsDomain) return;
    try {
      const res = await api.verifyDomainDns(activeDnsDomain.id);
      notify(`DNS verification status:\n${JSON.stringify(res, null, 2)}`);
      loadDomains();
    } catch (err: any) {
      notify(`Error verifying DNS: ${err.message}`, "error");
    }
  };

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Domain Management
          </h1>
          <p className="text-sm leading-6 text-muted-foreground mt-1.5">
            Configure virtual hosting domains, DKIM keys, and DNS deliverability
            records
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:opacity-90 font-semibold text-xs text-primary-foreground shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Domain
        </button>
      </div>

      {/* Domains Table */}
      <div
        role="region"
        aria-label="Domains table"
        tabIndex={0}
        className="rounded-2xl border border-border bg-card overflow-x-auto shadow-sm"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Domains list</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground">
              <th className="py-3 px-4 font-semibold">Domain Name</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">DKIM Selector</th>
              <th className="py-3 px-4 font-semibold">Created Date</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  Loading domains...
                </td>
              </tr>
            ) : domains.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No domains configured yet
                </td>
              </tr>
            ) : (
              domains.map((dom) => (
                <tr
                  key={dom.id}
                  className="hover:bg-muted/60 transition-colors"
                >
                  <td className="py-3.5 px-4 font-semibold text-foreground">
                    <Globe className="w-4 h-4 text-primary" />
                    {dom.name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-full bg-accent text-primary text-xs font-bold border border-primary/15">
                      {dom.isActive ? "ACTIVE" : "SUSPENDED"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-muted-foreground">
                    {dom.dkimSelector || "freemailo"}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">
                    {new Date(dom.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleOpenDns(dom)}
                      className="px-3 py-1.5 rounded-lg border border-input bg-secondary hover:bg-secondary text-primary font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      DNS Setup
                    </button>
                    <button
                      onClick={() => handleDeleteDomain(dom.id, dom.name)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete Domain"
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
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Virtual Domain"
        className="admin-dialog max-w-lg"
      >
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <form onSubmit={handleCreateDomain} className="space-y-4">
            <div>
              <label
                htmlFor="domain-name"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Domain Name (FQDN)
              </label>
              <input
                id="domain-name"
                type="text"
                required
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                placeholder="e.g. company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-secondary text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              <p className="text-sm leading-6 text-muted-foreground mt-1.5">
                We’ll prepare the signing key and DNS records for your domain.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Domain"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* DNS Records & Deliverability Modal */}
      <Modal
        open={dnsModalOpen}
        onClose={() => setDnsModalOpen(false)}
        title={`DNS Configuration: ${activeDnsDomain?.name || ""}`}
        className="admin-dialog max-w-3xl"
      >
        <div className="min-h-0 overflow-y-auto ">
          <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
            {loadingDns ? (
              <div className="py-12 text-center text-muted-foreground">
                Loading DNS records...
              </div>
            ) : (
              <>
                {/* MX Record */}
                <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">
                      1. MX (Mail Exchange)
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          "mx",
                          dnsData?.mx?.value ||
                            `10 mail.${activeDnsDomain?.name}`,
                        )
                      }
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedKey === "mx" ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedKey === "mx" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-foreground">
                    <div>
                      <span className="text-muted-foreground">Type:</span> MX
                    </div>
                    <div>
                      <span className="text-muted-foreground">Host:</span> @
                    </div>
                    <div>
                      <span className="text-muted-foreground">Priority:</span>{" "}
                      10
                    </div>
                    <div className="truncate">
                      <span className="text-muted-foreground">Value:</span>{" "}
                      {dnsData?.mx?.value || `mail.${activeDnsDomain?.name}`}
                    </div>
                  </div>
                </div>

                {/* SPF Record */}
                <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">
                      2. SPF (Sender Policy Framework)
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          "spf",
                          dnsData?.spf?.value || "v=spf1 mx ~all",
                        )
                      }
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedKey === "spf" ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedKey === "spf" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-foreground">
                    <div>
                      <span className="text-muted-foreground">Type:</span> TXT
                    </div>
                    <div>
                      <span className="text-muted-foreground">Host:</span> @
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="text-muted-foreground">Value:</span>{" "}
                      {dnsData?.spf?.value || "v=spf1 mx ~all"}
                    </div>
                  </div>
                </div>

                {/* DKIM Record */}
                <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">
                      3. DKIM (DomainKeys Identified Mail)
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard("dkim", dnsData?.dkim?.value || "")
                      }
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedKey === "dkim" ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedKey === "dkim" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs text-foreground">
                    <div>
                      <span className="text-muted-foreground">Type:</span> TXT
                    </div>
                    <div>
                      <span className="text-muted-foreground">Host:</span>{" "}
                      {dnsData?.dkim?.host ||
                        `freemailo._domainkey.${activeDnsDomain?.name}`}
                    </div>
                    <div className="p-2 bg-card rounded border border-border text-xs break-all">
                      {dnsData?.dkim?.value || "Loading DKIM public key..."}
                    </div>
                  </div>
                </div>

                {/* DMARC Record */}
                <div className="p-4 rounded-xl border border-border bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">4. DMARC</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          "dmarc",
                          dnsData?.dmarc?.value ||
                            `v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:postmaster@${activeDnsDomain?.name}`,
                        )
                      }
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedKey === "dmarc" ? (
                        <Check className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedKey === "dmarc" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs text-foreground">
                    <div>
                      <span className="text-muted-foreground">Type:</span> TXT
                    </div>
                    <div>
                      <span className="text-muted-foreground">Host:</span>{" "}
                      _dmarc.{activeDnsDomain?.name}
                    </div>
                    <div className="p-2 bg-card rounded border border-border text-xs break-all">
                      {dnsData?.dmarc?.value ||
                        `v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:postmaster@${activeDnsDomain?.name}`}
                    </div>
                  </div>
                </div>

                {/* PTR & MTA-STS Guidance */}
                <div className="p-4 rounded-xl border border-border bg-accent/40 text-accent-foreground text-xs font-sans space-y-1">
                  <p className="font-bold text-primary flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    PTR (Reverse DNS) & MTA-STS Recommendations
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Set up a PTR record with your VPS/hosting provider mapping
                    your public IPv4/IPv6 to{" "}
                    <code>mail.{activeDnsDomain?.name}</code> to prevent
                    Spamhaus/Gmail rejections.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-border bg-muted/50 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleVerifyDns}
              className="px-4 py-2 rounded-full bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Trigger DNS Verification Check
            </button>
            <button
              onClick={() => setDnsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-input text-muted-foreground hover:text-foreground text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
      {feedback}
    </div>
  );
}
