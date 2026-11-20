"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  PenTool,
  Tag,
  Shield,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { api, User as UserType, Label } from "@/lib/api";
import { Modal } from "@/components/ui/mail-ui";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onProfileUpdated: () => void;
  initialTab?: "profile" | "labels";
}

export function SettingsModal({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
  initialTab = "profile",
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "signatures" | "labels" | "trusted"
  >("profile");

  const [notice, setNotice] = useState("");
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#18786b");

  // Profile state
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // Signatures state
  const [signatures, setSignatures] = useState<
    Array<{ id: string; name: string; isDefault: boolean }>
  >([]);
  const [newSigName, setNewSigName] = useState("");
  const [newSigBody, setNewSigBody] = useState("");
  const [newSigDefault, setNewSigDefault] = useState(false);

  // Labels state
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");

  // Trusted senders
  const [trustedSenders, setTrustedSenders] = useState<
    Array<{ id: string; email: string }>
  >([]);
  const [newSenderEmail, setNewSenderEmail] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setDisplayName(user?.displayName || "");
    setNotice("");
    loadSignatures();
    loadLabels();
    loadTrustedSenders();
  }, [isOpen, initialTab, user?.displayName]);

  const loadSignatures = async () => {
    try {
      const data = await api.getSignatures();
      setSignatures(data.signatures || []);
    } catch (_) {
      setNotice(
        "Couldn’t load settings. Close and reopen Settings to try again.",
      );
    }
  };

  const loadLabels = async () => {
    try {
      const data = await api.getLabels();
      setLabels(data.labels || []);
    } catch (_) {
      setNotice(
        "Couldn’t load settings. Close and reopen Settings to try again.",
      );
    }
  };

  const loadTrustedSenders = async () => {
    try {
      const data = await api.getTrustedSenders();
      setTrustedSenders(data.senders || []);
    } catch (_) {
      setNotice(
        "Couldn’t load settings. Close and reopen Settings to try again.",
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.updateProfile(displayName);
      onProfileUpdated();
      setNotice("Profile updated successfully!");
    } catch (err: any) {
      setNotice(`Error updating profile: ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSigName.trim() || !newSigBody.trim()) return;
    try {
      await api.createSignature(newSigName, newSigBody, newSigDefault);
      setNewSigName("");
      setNewSigBody("");
      setNewSigDefault(false);
      loadSignatures();
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    }
  };

  const handleDeleteSignature = async (id: string) => {
    try {
      await api.deleteSignature(id);
      loadSignatures();
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    }
  };

  const handleAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    try {
      await api.createLabel(newLabelName, newLabelColor);
      setNewLabelName("");
      loadLabels();
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    }
  };

  const handleDeleteLabel = async (id: string) => {
    try {
      await api.deleteLabel(id);
      loadLabels();
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    }
  };

  const handleAddTrustedSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSenderEmail.trim()) return;
    try {
      await api.addTrustedSender(newSenderEmail.trim());
      setNewSenderEmail("");
      loadTrustedSenders();
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Settings"
      className="max-w-2xl"
    >
      <div className="flex h-[580px] max-h-[75dvh] flex-col overflow-hidden">
        {/* Tab Navigation */}
        <div className="shrink-0 overflow-x-auto px-5 border-b border-border flex gap-5 text-sm font-medium">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "signatures", label: "Signatures", icon: PenTool },
            { id: "labels", label: "Labels", icon: Tag },
            { id: "trusted", label: "Trusted Senders", icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 shrink-0 flex items-center gap-2 border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {notice && (
          <p
            role="status"
            className="mx-5 mt-4 rounded-xl border bg-secondary p-3 text-sm"
          >
            {notice}
          </p>
        )}
        {/* Tab Contents */}
        <div className="p-6 flex-1 overflow-y-auto text-sm">
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Email
                </label>
                <input
                  type="text"
                  aria-label="Email"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-muted-foreground text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  aria-label="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:ring-1 focus:ring-primary focus:outline-none text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          )}

          {/* SIGNATURES TAB */}
          {activeTab === "signatures" && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddSignature}
                className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3"
              >
                <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                  Create New Signature
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    aria-label="Signature name"
                    value={newSigName}
                    onChange={(e) => setNewSigName(e.target.value)}
                    placeholder="Signature Name (e.g. Work)"
                    className="px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newSigDefault}
                      onChange={(e) => setNewSigDefault(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    <span>Set as default signature</span>
                  </label>
                </div>
                <textarea
                  aria-label="Signature body"
                  value={newSigBody}
                  onChange={(e) => setNewSigBody(e.target.value)}
                  placeholder="HTML or text signature body..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs h-20 resize-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
                >
                  Add Signature
                </button>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Existing Signatures
                </h4>
                {signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                  >
                    <div>
                      <span className="font-semibold text-xs text-foreground">
                        {sig.name}
                      </span>
                      {sig.isDefault && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[10px] font-bold">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteSignature(sig.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Delete signature"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LABELS TAB */}
          {activeTab === "labels" && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddLabel}
                className="p-4 rounded-xl border border-border bg-secondary/30 flex flex-wrap items-center gap-3"
              >
                <input
                  type="text"
                  aria-label="New label name"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="New label name..."
                  className="min-w-0 flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
                />
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-8 h-8 rounded border-0 cursor-pointer p-0"
                  title="Choose color"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
                >
                  Create Label
                </button>
              </form>

              <div className="space-y-2">
                {labels.map((lbl) => (
                  <div
                    key={lbl.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
                  >
                    {editingLabel === lbl.id ? (
                      <form
                        className="flex w-full items-center gap-2"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          try {
                            await api.updateLabel(
                              lbl.id,
                              editName.trim(),
                              editColor,
                            );
                            setEditingLabel(null);
                            loadLabels();
                            onProfileUpdated();
                          } catch (error) {
                            setNotice(
                              error instanceof Error
                                ? error.message
                                : "Couldn’t update label.",
                            );
                          }
                        }}
                      >
                        <input
                          aria-label="Label name"
                          required
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="field min-w-0 flex-1"
                        />
                        <input
                          type="color"
                          aria-label="Label color"
                          value={editColor}
                          onChange={(event) => setEditColor(event.target.value)}
                          className="h-8 w-8"
                        />
                        <button className="primary-button" type="submit">
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLabel(null)}
                          className="p-2 text-xs"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: lbl.color || "#3b82f6" }}
                          />
                          <span className="text-xs font-semibold text-foreground">
                            {lbl.name}
                          </span>
                        </div>
                        {!lbl.isSystem && (
                          <button
                            type="button"
                            className="ml-auto rounded px-2 py-1 text-xs text-primary hover:bg-accent"
                            onClick={() => {
                              setEditingLabel(lbl.id);
                              setEditName(lbl.name);
                              setEditColor(lbl.color || "#18786b");
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {!lbl.isSystem && (
                          <button
                            onClick={() => handleDeleteLabel(lbl.id)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title={`Delete label ${lbl.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRUSTED SENDERS TAB */}
          {activeTab === "trusted" && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddTrustedSender}
                className="p-4 rounded-xl border border-border bg-secondary/30 flex flex-wrap items-center gap-3"
              >
                <input
                  type="email"
                  aria-label="Trusted sender email"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  placeholder="sender@domain.com"
                  className="min-w-0 flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
                >
                  Trust Sender
                </button>
              </form>

              <div className="space-y-2">
                {trustedSenders.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-background"
                  >
                    <span className="text-xs font-mono text-foreground">
                      {s.email}
                    </span>
                  </div>
                ))}
                {trustedSenders.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    No trusted senders added yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
