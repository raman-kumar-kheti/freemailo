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
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            System Audit Trail
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Immutable log of all administrative actions, domain updates, and
            mailbox modifications
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs">
        <span className="text-zinc-400 font-medium">Action Filter:</span>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white focus:outline-none"
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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <th className="py-3 px-4 font-semibold">Action</th>
              <th className="py-3 px-4 font-semibold">Entity</th>
              <th className="py-3 px-4 font-semibold">Actor</th>
              <th className="py-3 px-4 font-semibold">IP Address</th>
              <th className="py-3 px-4 font-semibold">Metadata</th>
              <th className="py-3 px-4 font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-200 font-mono text-[11px]">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-zinc-500 font-sans"
                >
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-zinc-500 font-sans"
                >
                  No audit logs recorded
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-indigo-400 font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-300 font-sans">
                    {log.resourceType}{" "}
                    <span className="text-zinc-500 text-[10px] font-mono">
                      ({log.resourceId})
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-300 font-sans">
                    {`${log.actorType}: ${log.actorId}`}
                  </td>
                  <td className="py-3 px-4 text-zinc-500">
                    {log.ipAddress || "—"}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : "-"}
                  </td>
                  <td className="py-3 px-4 text-zinc-500 font-sans">
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
