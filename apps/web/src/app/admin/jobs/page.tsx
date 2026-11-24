"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";

export default function JobsAdminPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminJobs(1, 100, statusFilter || undefined);
      setJobs(res.data || (Array.isArray(res) ? res : []));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load jobs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-accent text-primary text-xs font-bold border border-primary/15 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case "DEAD_LETTER":
      case "FAILED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20 flex items-center gap-1 w-max">
            <XCircle className="w-3 h-3" />
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-500/20 flex items-center gap-1 w-max">
            <Clock className="w-3 h-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            BullMQ Provisioning Queue
          </h1>
          <p className="text-sm leading-6 text-muted-foreground mt-1.5">
            Track background tasks, review failures and retry jobs.
          </p>
        </div>
        <button
          onClick={loadJobs}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-input bg-secondary text-xs text-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {/* Filter */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border text-xs">
        <label
          htmlFor="job-status"
          className="text-muted-foreground font-medium"
        >
          Status
        </label>
        <select
          id="job-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-input bg-secondary text-foreground focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="DEAD_LETTER">Dead letter</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
        </select>
      </div>

      {/* Table */}
      <div
        role="region"
        aria-label="Jobs table"
        tabIndex={0}
        className="rounded-2xl border border-border bg-card overflow-x-auto shadow-sm"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Jobs list</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50 text-muted-foreground">
              <th className="py-3 px-4 font-semibold">Job ID</th>
              <th className="py-3 px-4 font-semibold">Operation Type</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Attempts</th>
              <th className="py-3 px-4 font-semibold">
                Payload / Error Details
              </th>
              <th className="py-3 px-4 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground font-sans"
                >
                  Loading provisioning jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground font-sans"
                >
                  No jobs found in queue
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-muted/60 transition-colors"
                >
                  <td className="py-3 px-4 text-primary truncate max-w-[120px]">
                    {job.id}
                  </td>
                  <td className="py-3 px-4 text-foreground font-semibold">
                    {job.type}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(job.status)}
                    {["FAILED", "DEAD_LETTER"].includes(job.status) && (
                      <button
                        disabled={retrying === job.id}
                        className="mt-2 rounded border border-input px-2 py-1 text-foreground"
                        onClick={async () => {
                          setRetrying(job.id);
                          setError("");
                          try {
                            await api.retryAdminJob(job.id);
                            await loadJobs();
                          } catch (error) {
                            setError(
                              error instanceof Error
                                ? error.message
                                : "Retry failed",
                            );
                          } finally {
                            setRetrying(null);
                          }
                        }}
                      >
                        {retrying === job.id ? "Retrying…" : "Retry job"}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {job.attempts} / {job.maxAttempts || 3}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-xs truncate text-xs">
                    {job.lastError ? (
                      <span className="text-destructive">{job.lastError}</span>
                    ) : (
                      JSON.stringify(job.payload)
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground font-sans text-xs">
                    {new Date(job.createdAt).toLocaleString()}
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
