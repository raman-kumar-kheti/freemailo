"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Forward, Plus, Trash2, Globe, X } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/mail-ui";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";

export default function AliasesAdminPage() {
  const { notify, confirmAction, feedback } = useAdminFeedback();
  const [aliases, setAliases] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Alias Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sourceUsername, setSourceUsername] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [destinationEmail, setDestinationEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const loadDomains = useCallback(async () => {
    try {
      const res = await api.listAdminDomains(1, 100);
      const list = res.data || (Array.isArray(res) ? res : []);
      setDomains(list);
      if (list.length > 0)
        setSelectedDomainId((current) => current || list[0].id);
    } catch (_) {}
  }, []);

  const loadAliases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminAliases();
      setAliases(res.data || (Array.isArray(res) ? res : []));
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDomains();
    void loadAliases();
  }, [loadDomains, loadAliases]);

  const handleCreateAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUsername.trim() || !selectedDomainId || !destinationEmail.trim())
      return;

    const domainObj = domains.find((d) => d.id === selectedDomainId);
    if (!domainObj) return;

    setCreating(true);
    try {
      const fullSource = `${sourceUsername.trim()}@${domainObj.name}`;
      await api.createAdminAlias(
        fullSource,
        destinationEmail.trim(),
        selectedDomainId,
      );
      setSourceUsername("");
      setDestinationEmail("");
      setAddModalOpen(false);
      loadAliases();
    } catch (err: any) {
      notify(`Error creating alias: ${err.message}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAlias = async (id: string, source: string) => {
    if (!(await confirmAction(`Delete alias '${source}'?`))) return;
    try {
      await api.deleteAdminAlias(id);
      loadAliases();
    } catch (err: any) {
      notify(`Error deleting alias: ${err.message}`, "error");
    }
  };

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Aliases & Forwarding
          </h1>
          <p className="text-sm leading-6 text-muted-foreground mt-1.5">
            Map incoming addresses to hosted mailbox destinations
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary hover:opacity-90 font-semibold text-xs text-primary-foreground shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Alias
        </button>
      </div>

      {/* Aliases Table */}
      <div
        role="region"
        aria-label="Aliases table"
        tabIndex={0}
        className="rounded-2xl border border-border bg-card overflow-x-auto shadow-sm"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Aliases list</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground">
              <th className="py-3 px-4 font-semibold">Source Address</th>
              <th className="py-3 px-4 font-semibold">Forward Destination</th>
              <th className="py-3 px-4 font-semibold">Created Date</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {loading ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  Loading aliases...
                </td>
              </tr>
            ) : aliases.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No aliases configured
                </td>
              </tr>
            ) : (
              aliases.map((al) => (
                <tr key={al.id} className="hover:bg-muted/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-foreground">
                    <Forward className="w-4 h-4 text-primary" />
                    {al.sourceAddress}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-foreground">
                    &rarr; {al.destinationEmail}
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">
                    {new Date(al.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDeleteAlias(al.id, al.sourceAddress)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Delete Alias"
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
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Create Email Alias"
        className="admin-dialog max-w-lg"
      >
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <form onSubmit={handleCreateAlias} className="space-y-4">
            <div>
              <label
                htmlFor="alias-source"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Source Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  id="alias-source"
                  value={sourceUsername}
                  onChange={(e) => setSourceUsername(e.target.value)}
                  placeholder="e.g. sales"
                  className="min-w-0 w-full flex-1 px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground focus:outline-none"
                />
                <span className="text-muted-foreground">@</span>
                <select
                  aria-label="Alias domain"
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
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
                htmlFor="alias-destination"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Forward Destination Address
              </label>
              <input
                type="email"
                required
                id="alias-destination"
                value={destinationEmail}
                onChange={(e) => setDestinationEmail(e.target.value)}
                placeholder="e.g. alice@example.test"
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
                {creating ? "Creating..." : "Create Alias"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
      {feedback}
    </div>
  );
}
