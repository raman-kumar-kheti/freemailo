"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Mail,
  Forward,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Server,
} from "lucide-react";
import { api } from "@/lib/api";

export default function AdminOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    domains: 0,
    mailboxes: 0,
    aliases: 0,
    jobs: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<
    Record<string, { status: string; latencyMs?: number }>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [domainsRes, mailboxesRes, aliasesRes, jobsRes, logsRes] =
          await Promise.all([
            api.listAdminDomains(1, 1),
            api.listAdminMailboxes(undefined, 1, 1),
            api.listAdminAliases(),
            api.listAdminJobs(1, 1),
            api.listAdminAuditLogs(1, 5),
          ]);

        setStats({
          domains:
            domainsRes.meta?.total ??
            (domainsRes.data ? domainsRes.data.length : 0),
          mailboxes:
            mailboxesRes.meta?.total ??
            (mailboxesRes.data ? mailboxesRes.data.length : 0),
          aliases:
            aliasesRes.meta?.total ??
            (aliasesRes.data
              ? aliasesRes.data.length
              : Array.isArray(aliasesRes)
                ? aliasesRes.length
                : 0),
          jobs: jobsRes.meta?.total ?? (jobsRes.data ? jobsRes.data.length : 0),
        });
        setRecentLogs(logsRes.data || (Array.isArray(logsRes) ? logsRes : []));
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Could not load dashboard",
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
    const loadHealth = () =>
      fetch("/api/health")
        .then((response) => response.json())
        .then((data) => setHealth(data.services || {}))
        .catch(() => setHealth({ api: { status: "unavailable" } }));
    void loadHealth();
    const timer = setInterval(loadHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  const statCards = [
    {
      title: "Hosted Domains",
      value: stats.domains,
      icon: Globe,
      color: "from-blue-500 to-cyan-500",
      href: "/admin/domains",
    },
    {
      title: "Mailboxes",
      value: stats.mailboxes,
      icon: Mail,
      color: "from-indigo-500 to-purple-500",
      href: "/admin/mailboxes",
    },
    {
      title: "Aliases & Forwards",
      value: stats.aliases,
      icon: Forward,
      color: "from-emerald-500 to-teal-500",
      href: "/admin/aliases",
    },
    {
      title: "Provisioning Jobs",
      value: stats.jobs,
      icon: Cpu,
      color: "from-amber-500 to-orange-500",
      href: "/admin/jobs",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          System Overview
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Real-time cluster telemetry, virtual email domains, and infrastructure
          provisioning
        </p>
      </div>

      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => router.push(card.href)}
              className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all hover:shadow-xl group"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-md`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </div>
              <p className="text-xs font-medium text-zinc-400">{card.title}</p>
              <p className="text-2xl font-bold text-white mt-1">
                {loading ? "..." : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Service Health Grid */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" />
          Infrastructure Health Matrix
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {Object.entries(health)
            .map(([name, service]) => ({
              name,
              status: service.status.toUpperCase(),
              port:
                service.latencyMs === undefined
                  ? ""
                  : `${service.latencyMs} ms`,
            }))
            .map((svc) => (
              <div
                key={svc.name}
                className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-2 h-2 rounded-full ${svc.status === "UP" ? "bg-emerald-400" : "bg-red-400"}`}
                  />
                  <span className="font-mono text-[10px] text-zinc-500">
                    {svc.port}
                  </span>
                </div>
                <p className="font-semibold text-zinc-200 truncate">
                  {svc.name}
                </p>
                <p
                  className={`text-[10px] font-bold ${svc.status === "UP" ? "text-emerald-400" : "text-red-400"}`}
                >
                  {svc.status}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Recent Audit Trail Preview */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            Recent Administrative Events
          </h2>
          <button
            onClick={() => router.push("/admin/audit")}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            View Full Audit Trail &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300 font-mono">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-800/30">
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 text-[11px] font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400">
                    {log.resourceType} / {log.resourceId}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400">{`${log.actorType}: ${log.actorId}`}</td>
                  <td className="py-2.5 px-3 text-zinc-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-zinc-500 italic"
                  >
                    No recent audit events
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
