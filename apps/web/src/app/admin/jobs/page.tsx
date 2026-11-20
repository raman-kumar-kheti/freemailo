'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export default function JobsAdminPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadJobs();
  }, [statusFilter]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await api.listAdminJobs(1, 100, statusFilter || undefined);
      setJobs(res.data || (Array.isArray(res) ? res : []));
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 font-mono text-[10px] font-bold border border-red-500/20 flex items-center gap-1 w-max">
            <XCircle className="w-3 h-3" />
            FAILED / DLQ
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold border border-amber-500/20 flex items-center gap-1 w-max">
            <Clock className="w-3 h-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BullMQ Provisioning Queue</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time status of idempotent background jobs, Maildir provisioning, and DLQ errors
          </p>
        </div>
        <button
          onClick={loadJobs}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs">
        <span className="text-zinc-400 font-medium">Status Filter:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <th className="py-3 px-4 font-semibold">Job ID</th>
              <th className="py-3 px-4 font-semibold">Operation Type</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Attempts</th>
              <th className="py-3 px-4 font-semibold">Payload / Error Details</th>
              <th className="py-3 px-4 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-200 font-mono">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-500 font-sans">
                  Loading provisioning jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-500 font-sans">
                  No jobs found in queue
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4 text-indigo-400 truncate max-w-[120px]">{job.id}</td>
                  <td className="py-3 px-4 text-zinc-300 font-semibold">{job.jobType}</td>
                  <td className="py-3 px-4">{getStatusBadge(job.status)}</td>
                  <td className="py-3 px-4 text-zinc-400">{job.attempts} / {job.maxAttempts || 3}</td>
                  <td className="py-3 px-4 text-zinc-400 max-w-xs truncate text-[11px]">
                    {job.errorMessage ? (
                      <span className="text-red-400">{job.errorMessage}</span>
                    ) : (
                      JSON.stringify(job.payload)
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-500 font-sans text-[11px]">
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
