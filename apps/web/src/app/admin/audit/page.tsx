"use client";

import React, { useState, useEffect, useCallback } from "react";
import { History, RefreshCw, Filter } from "lucide-react";
import { api } from "@/lib/api";

export default function AuditAdminPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminAuditLogs(
        1,
        100,
        actionFilter || undefined,
      );
      setLogs(res.data || (Array.isArray(res) ? res : []));
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            System Audit Trail
          </h1>
          <p className="text-sm leading-6 text-muted-foreground mt-1.5">
            Review changes to domains, mailboxes and account settings.
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border text-xs">
        <label
          htmlFor="audit-action"
          className="text-muted-foreground font-medium"
        >
          Action
        </label>
        <select
          id="audit-action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-input bg-secondary text-foreground focus:outline-none"
        >
          <option value="">All Actions</option>
          <option value="DOMAIN_CREATED">Domain Created</option>
          <option value="DOMAIN_DELETED">Domain Deleted</option>
          <option value="MAILBOX_CREATED">Mailbox Created</option>
          <option value="MAILBOX_UPDATED">Mailbox Updated</option>
          <option value="MAILBOX_DELETED">Mailbox Deleted</option>
          <option value="ALIAS_CREATED">Alias Created</option>
        </select>
      </div>

      {/* Table */}
      <div
        role="region"
        aria-label="Audit table"
        tabIndex={0}
        className="rounded-2xl border border-border bg-card overflow-x-auto shadow-sm"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Audit list</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground">
              <th className="py-3 px-4 font-semibold">Action</th>
              <th className="py-3 px-4 font-semibold">Entity</th>
              <th className="py-3 px-4 font-semibold">Actor</th>
              <th className="py-3 px-4 font-semibold">IP Address</th>
              <th className="py-3 px-4 font-semibold">Metadata</th>
              <th className="py-3 px-4 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground text-xs">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground font-sans"
                >
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground font-sans"
                >
                  No audit logs recorded
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-muted/60 transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-secondary text-primary font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-foreground font-sans">
                    {log.resourceType}{" "}
                    <span className="text-muted-foreground text-xs font-mono">
                      ({log.resourceId})
                    </span>
                  </td>
                  <td className="py-3 px-4 text-foreground font-sans">
                    {`${log.actorType}: ${log.actorId}`}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {log.ipAddress || "—"}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : "-"}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground font-sans">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
