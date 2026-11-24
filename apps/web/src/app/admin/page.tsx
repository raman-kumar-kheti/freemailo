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
      href: "/admin/domains",
    },
    {
      title: "Mailboxes",
      value: stats.mailboxes,
      icon: Mail,
      href: "/admin/mailboxes",
    },
    {
      title: "Aliases & Forwards",
      value: stats.aliases,
      icon: Forward,
      href: "/admin/aliases",
    },
    {
      title: "Provisioning Jobs",
      value: stats.jobs,
      icon: Cpu,
      href: "/admin/jobs",
    },
  ];

  return (
    <div className="admin-page space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          System Overview
        </h1>
        <p className="text-sm leading-6 text-muted-foreground mt-1.5">
          An overview of your domains, mailboxes and mail services.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.title}
              onClick={() => router.push(card.href)}
              className="text-left p-5 rounded-2xl bg-card border border-border hover:border-input cursor-pointer transition-colors hover:shadow-sm group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {card.title}
              </p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {loading ? "..." : card.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Service Health Grid */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
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
                className="p-3 rounded-xl bg-muted/50 border border-border space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-2 h-2 rounded-full ${svc.status === "UP" ? "bg-primary" : "bg-destructive"}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {svc.port}
                  </span>
                </div>
                <p className="font-semibold text-foreground truncate">
                  {svc.name}
                </p>
                <p
                  className={`text-xs font-semibold ${svc.status === "UP" ? "text-primary" : "text-destructive"}`}
                >
                  {svc.status}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Recent Audit Trail Preview */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">
            Recent Administrative Events
          </h2>
          <button
            onClick={() => router.push("/admin/audit")}
            className="text-xs text-primary hover:text-primary font-semibold"
          >
            View Full Audit Trail &rarr;
          </button>
        </div>

        <div
          role="region"
          aria-label="Recent administrative events"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recent administrative events</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground ">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/50">
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-secondary text-primary text-xs font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {log.resourceType} / {log.resourceId}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{`${log.actorType}: ${log.actorId}`}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {recentLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-muted-foreground italic"
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
