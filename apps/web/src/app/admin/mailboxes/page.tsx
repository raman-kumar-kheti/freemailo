"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/mail-ui";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";

export default function MailboxesAdminPage() {
  const { notify, confirmAction, feedback } = useAdminFeedback();
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Add Mailbox Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDomainId, setNewDomainId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newQuotaMB, setNewQuotaMB] = useState(1024);
  const [creating, setCreating] = useState(false);

  // Edit / Password Reset Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeMailbox, setActiveMailbox] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [editQuotaMB, setEditQuotaMB] = useState(1024);
  const [updating, setUpdating] = useState(false);

  const loadDomains = useCallback(async () => {
    try {
      const res = await api.listAdminDomains(1, 100);
      const list = res.data || (Array.isArray(res) ? res : []);
      setDomains(list);
      if (list.length > 0) setNewDomainId((current) => current || list[0].id);
    } catch (_) {}
  }, []);

  const loadMailboxes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminMailboxes(
        selectedDomain || undefined,
        1,
        100,
      );
      setMailboxes(res.data || (Array.isArray(res) ? res : []));
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [selectedDomain]);

  useEffect(() => {
    void loadDomains();
    void loadMailboxes();
  }, [loadDomains, loadMailboxes]);

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newDomainId || !newPassword) return;

    const domainObj = domains.find((d) => d.id === newDomainId);
    if (!domainObj) return;

    setCreating(true);
    try {
      const fullEmail = `${newUsername.trim()}@${domainObj.name}`;
      await api.createAdminMailbox({
        localPart: newUsername.trim(),
        password: newPassword,
        quotaBytes: newQuotaMB * 1024 * 1024,
        domainId: newDomainId,
      });

      setNewUsername("");
      setNewPassword("");
      setAddModalOpen(false);
      notify(
        `Mailbox '${fullEmail}' provisioning job queued successfully!`,
        "success",
      );
      loadMailboxes();
    } catch (err: any) {
      notify(`Error creating mailbox: ${err.message}`, "error");
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
      setResetPassword("");
      loadMailboxes();
      notify("Mailbox updated successfully!", "success");
    } catch (err: any) {
      notify(`Error updating mailbox: ${err.message}`, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMailbox = async (id: string, email: string) => {
    if (
      !(await confirmAction(
        `Are you sure you want to delete mailbox '${email}'? Maildir will be marked for cleanup.`,
      ))
    )
      return;
    try {
      await api.deleteAdminMailbox(id);
      loadMailboxes();
    } catch (err: any) {
      notify(`Error deleting mailbox: ${err.message}`, "error");
    }
  };

  const filtered = mailboxes.filter((m) =>
    searchTerm
      ? m.email.toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  );

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Mailbox Provisioning
          </h1>
          <p className="text-sm leading-6 text-muted-foreground mt-1.5">
            Manage virtual user mailboxes, storage quotas, and security
            credentials
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:opacity-90 font-semibold text-xs text-primary-foreground shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Mailbox
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border text-xs">
        <div className="flex items-center gap-3">
          <label
            htmlFor="mailbox-domain-filter"
            className="text-muted-foreground font-medium"
          >
            Domain
          </label>
          <select
            id="mailbox-domain-filter"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-input bg-secondary text-foreground focus:outline-none"
          >
            <option value="">All Domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search mailboxes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search mailboxes..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-input bg-secondary text-foreground placeholder:text-muted-foreground text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Mailboxes Table */}
      <div
        role="region"
        aria-label="Mailboxes table"
        tabIndex={0}
        className="rounded-2xl border border-border bg-card overflow-x-auto shadow-sm"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Mailboxes list</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground">
              <th className="py-3 px-4 font-semibold">Mailbox Address</th>
              <th className="py-3 px-4 font-semibold">Domain</th>
              <th className="py-3 px-4 font-semibold">Quota Usage</th>
              <th className="py-3 px-4 font-semibold">Status</th>
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
                  Loading mailboxes...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No mailboxes found
                </td>
              </tr>
            ) : (
              filtered.map((mb) => {
                const quotaMB = Math.round(
                  (Number(mb.quotaBytes) || 1073741824) / (1024 * 1024),
                );
                const usedMB =
                  mb.usedBytes == null
                    ? null
                    : Number(mb.usedBytes) / (1024 * 1024);
                const percent = Math.min(
                  Math.round(((usedMB || 0) / quotaMB) * 100),
                  100,
                );

                return (
                  <tr
                    key={mb.id}
                    className="hover:bg-muted/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <Mail className="w-4 h-4 text-primary" />
                      {mb.email}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {mb.domain?.name || mb.email.split("@")[1]}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="w-48 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground font-mono">
                          <span>
                            {usedMB === null
                              ? "Usage unavailable"
                              : `${usedMB.toFixed(2)} MB`}
                          </span>
                          <span>{quotaMB} MB</span>
                        </div>
                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-accent text-primary text-xs font-bold border border-primary/15">
                        {mb.isActive ? "ACTIVE" : "SUSPENDED"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setActiveMailbox(mb);
                          setEditQuotaMB(quotaMB);
                          setEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Edit Mailbox / Password"
                        title="Edit Mailbox / Password"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMailbox(mb.id, mb.email)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete Mailbox"
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
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Provision New Mailbox"
        className="admin-dialog max-w-lg"
      >
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <form onSubmit={handleCreateMailbox} className="space-y-4">
            <div>
              <label
                htmlFor="mailbox-address"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Mailbox Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  id="mailbox-address"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  className="min-w-0 w-full flex-1 px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground focus:outline-none"
                />
                <span className="text-muted-foreground">@</span>
                <select
                  aria-label="Mailbox domain"
                  value={newDomainId}
                  onChange={(e) => setNewDomainId(e.target.value)}
                  className="min-w-0 max-w-[55%] px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground focus:outline-none"
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
              <label
                htmlFor="mailbox-password"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Password
              </label>
              <input
                type="password"
                required
                id="mailbox-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="mailbox-quota"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Storage Quota (MB)
              </label>
              <input
                type="number"
                min="100"
                step="1"
                id="mailbox-quota"
                value={newQuotaMB}
                onChange={(e) => setNewQuotaMB(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground focus:outline-none"
              />
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
                {creating ? "Queueing..." : "Provision Mailbox"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Edit Mailbox / Reset Password Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit: ${activeMailbox?.email || "mailbox"}`}
        className="admin-dialog max-w-lg"
      >
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <form onSubmit={handleUpdateMailbox} className="space-y-4">
            <div>
              <label
                htmlFor="reset-password"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Reset Password (leave empty to keep current)
              </label>
              <input
                type="password"
                id="reset-password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password..."
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="edit-quota"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Quota Limit (MB)
              </label>
              <input
                type="number"
                min="100"
                step="1"
                id="edit-quota"
                value={editQuotaMB}
                onChange={(e) => setEditQuotaMB(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
      {feedback}
    </div>
  );
}
