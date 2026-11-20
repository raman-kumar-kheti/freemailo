// API Client for MailHive Webmail

const API_BASE = "/api";

export interface User {
  id: string;
  email: string;
  domain: string;
  role: string;
  displayName?: string;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
  isSystem?: boolean;
}

export interface Folder {
  name: string;
  path: string;
  delimiter: string;
  specialUse: string | null;
  total: number;
  unread: number;
  children: Folder[];
}

export interface MessageListItem {
  uid: number;
  messageId: string;
  threadId: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  subject: string;
  snippet: string;
  date: string;
  flags: string[];
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labels: string[];
  size: number;
}

export interface MessageDetail {
  uid: number;
  messageId: string;
  threadId: string;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  cc: Array<{ name: string; address: string }>;
  bcc: Array<{ name: string; address: string }>;
  replyTo: Array<{ name: string; address: string }>;
  subject: string;
  date: string;
  flags: string[];
  isRead: boolean;
  isStarred: boolean;
  htmlBody: string;
  textBody: string;
  attachments: Array<{
    partId: string;
    filename: string;
    contentType: string;
    size: number;
    contentId: string | null;
  }>;
  headers: Record<string, string>;
  authResults: {
    spf: "pass" | "fail" | "softfail" | "neutral" | "none";
    dkim: "pass" | "fail" | "none";
    dmarc: "pass" | "fail" | "none";
  };
}

class ApiClient {
  private token: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mailhive_token");
    }
  }

  setToken(token: string | null) {
    // Browser authentication uses HTTP-only cookies; never retain JWTs in JS.
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("mailhive_token");
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "X-Requested-With": "MailHive",
      ...(options.headers as Record<string, string>),
    };

    if (this.token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include", // sends refresh token cookie
    });

    if (
      res.status === 401 &&
      retry &&
      path !== "/auth/login" &&
      path !== "/auth/admin/login" &&
      path !== "/auth/refresh"
    ) {
      // Concurrent 401 responses share one rotation request.
      if (!this.refreshing) {
        this.refreshing = fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "X-Requested-With": "MailHive" },
        })
          .then(async (response) => {
            if (!response.ok) return false;
            this.setToken((await response.json()).accessToken);
            return true;
          })
          .catch(() => false)
          .finally(() => {
            this.refreshing = null;
          });
      }
      if (await this.refreshing) return this.request<T>(path, options, false);
      this.setToken(null);
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.href = window.location.pathname.startsWith("/admin")
          ? "/admin/login"
          : "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      let errMessage = `Error ${res.status}`;
      try {
        const errJson = await res.json();
        errMessage = errJson.message || errMessage;
      } catch (_) {}
      throw new Error(errMessage);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json();
  }

  // --- Auth ---
  async login(email: string, password: string) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.accessToken);
    return data;
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST" });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<{ user: User }> {
    const response = await this.request<User | { user: User }>("/auth/me");
    return { user: "user" in response ? response.user : response };
  }

  // --- Mail ---
  async getFolders(): Promise<{ folders: Folder[] }> {
    return this.request("/mail/folders");
  }

  async getMessages(
    folder = "INBOX",
    page = 1,
    pageSize = 50,
    sort = "date",
    order = "desc",
  ): Promise<{
    data: MessageListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.request(
      `/mail/messages?folder=${encodeURIComponent(folder)}&page=${page}&pageSize=${pageSize}&sort=${sort}&order=${order}`,
    );
  }

  async getMessage(uid: number, folder = "INBOX"): Promise<MessageDetail> {
    return this.request(
      `/mail/messages/${uid}?folder=${encodeURIComponent(folder)}`,
    );
  }

  async getRawMessage(uid: number, folder = "INBOX"): Promise<string> {
    const res = await fetch(
      `${API_BASE}/mail/messages/${uid}/raw?folder=${encodeURIComponent(folder)}`,
      {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        credentials: "include",
      },
    );
    if (!res.ok) throw new Error("Could not load the original message.");
    return res.text();
  }

  async sendMail(payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    htmlBody?: string;
    textBody?: string;
    inReplyTo?: string;
    references?: string[];
    signatureId?: string;
    attachments?: File[];
  }) {
    if (payload.attachments && payload.attachments.length > 0) {
      const formData = new FormData();
      formData.append("to", JSON.stringify(payload.to));
      if (payload.cc) formData.append("cc", JSON.stringify(payload.cc));
      if (payload.bcc) formData.append("bcc", JSON.stringify(payload.bcc));
      formData.append("subject", payload.subject);
      if (payload.htmlBody) formData.append("htmlBody", payload.htmlBody);
      if (payload.textBody) formData.append("textBody", payload.textBody);
      if (payload.inReplyTo) formData.append("inReplyTo", payload.inReplyTo);
      if (payload.signatureId)
        formData.append("signatureId", payload.signatureId);
      if (payload.references)
        formData.append("references", JSON.stringify(payload.references));
      payload.attachments.forEach((file) =>
        formData.append("attachments", file),
      );

      return this.request("/mail/send", {
        method: "POST",
        body: formData,
      });
    }

    return this.request("/mail/send", {
      method: "POST",
      body: JSON.stringify({ ...payload, attachments: undefined }),
    });
  }

  async saveDraft(
    payload: {
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      htmlBody?: string;
      textBody?: string;
    },
    existingUid?: number,
  ) {
    if (existingUid) {
      return this.request(`/mail/draft/${existingUid}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }
    return this.request("/mail/draft", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateFlags(
    folder: string,
    uids: number[],
    flags: string[],
    action: "add" | "remove" | "set",
  ) {
    return this.request("/mail/messages/flags", {
      method: "PATCH",
      body: JSON.stringify({ folder, uids, flags, action }),
    });
  }

  async moveMessages(
    sourceFolder: string,
    destinationFolder: string,
    uids: number[],
  ) {
    return this.request("/mail/messages/move", {
      method: "POST",
      body: JSON.stringify({ sourceFolder, destinationFolder, uids }),
    });
  }

  async deleteMessages(folder: string, uids: number[], permanent = false) {
    return this.request("/mail/messages", {
      method: "DELETE",
      body: JSON.stringify({ folder, uids, permanent }),
    });
  }

  async searchMessages(
    query: string,
    folder = "INBOX",
    page = 1,
    pageSize = 50,
  ) {
    return this.request(
      `/mail/search?q=${encodeURIComponent(query)}&folder=${encodeURIComponent(folder)}&page=${page}&pageSize=${pageSize}`,
    );
  }

  getAttachmentUrl(uid: number, partId: string, folder = "INBOX"): string {
    return `${API_BASE}/mail/attachments/${uid}/${encodeURIComponent(partId)}?folder=${encodeURIComponent(folder)}`;
  }

  // --- Settings ---
  async changePassword(currentPassword: string, newPassword: string) {
    return this.request("/settings/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }
  async getVacation() {
    return this.request("/settings/vacation");
  }
  async saveVacation(payload: {
    isActive: boolean;
    subject: string;
    body: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.request("/settings/vacation", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async getProfile() {
    return this.request("/settings/profile");
  }

  async updateProfile(displayName: string) {
    return this.request("/settings/profile", {
      method: "PUT",
      body: JSON.stringify({ displayName }),
    });
  }

  async getSignatures() {
    return this.request("/settings/signatures");
  }

  async createSignature(name: string, body: string, isDefault = false) {
    return this.request("/settings/signatures", {
      method: "POST",
      body: JSON.stringify({ name, body, isDefault }),
    });
  }

  async deleteSignature(id: string) {
    return this.request(`/settings/signatures/${id}`, { method: "DELETE" });
  }

  async getLabels() {
    return this.request("/settings/labels");
  }

  async createLabel(name: string, color?: string) {
    return this.request("/settings/labels", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
  }

  async updateLabel(id: string, name: string, color?: string) {
    return this.request(`/settings/labels/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, color }),
    });
  }

  async downloadAttachment(
    uid: number,
    partId: string,
    folder: string,
    filename: string,
  ) {
    const res = await fetch(this.getAttachmentUrl(uid, partId, folder), {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      credentials: "include",
    });
    if (!res.ok)
      throw new Error("Could not download the attachment. Please try again.");
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async deleteLabel(id: string) {
    return this.request(`/settings/labels/${id}`, { method: "DELETE" });
  }

  async getContacts(q?: string) {
    return this.request(
      `/settings/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    );
  }

  async getTrustedSenders() {
    return this.request("/settings/trusted-senders");
  }

  async addTrustedSender(email: string) {
    return this.request("/settings/trusted-senders", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  // --- Admin APIs ---
  async adminLogin(email: string, password: string) {
    const data = await this.request("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.accessToken);
    if (typeof window !== "undefined") {
      localStorage.setItem("mailhive_admin_user", JSON.stringify(data.user));
    }
    return data;
  }

  async listAdminDomains(page = 1, pageSize = 50, search?: string) {
    return this.request(
      `/admin/domains?page=${page}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    );
  }

  async createAdminDomain(name: string) {
    return this.request("/admin/domains", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async deleteAdminDomain(id: string) {
    return this.request(`/admin/domains/${id}`, { method: "DELETE" });
  }

  async getDomainDns(id: string) {
    return this.request(`/admin/domains/${id}/dns`);
  }

  async verifyDomainDns(id: string) {
    return this.request(`/admin/domains/${id}/verify`, { method: "POST" });
  }

  async listAdminMailboxes(domainId?: string, page = 1, pageSize = 50) {
    return this.request(
      `/admin/mailboxes?page=${page}&pageSize=${pageSize}${domainId ? `&domainId=${domainId}` : ""}`,
    );
  }

  async createAdminMailbox(payload: {
    localPart: string;
    password: string;
    quotaBytes?: number;
    domainId: string;
  }) {
    return this.request("/admin/mailboxes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAdminMailbox(
    id: string,
    payload: { password?: string; quotaBytes?: number; isActive?: boolean },
  ) {
    return this.request(`/admin/mailboxes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteAdminMailbox(id: string) {
    return this.request(`/admin/mailboxes/${id}`, { method: "DELETE" });
  }

  async listAdminAliases(domainId?: string) {
    return this.request(
      `/admin/aliases${domainId ? `?domainId=${domainId}` : ""}`,
    );
  }

  async createAdminAlias(
    sourceAddress: string,
    destinationEmail: string,
    _domainId: string,
  ) {
    const results = await this.request(
      `/admin/mailboxes?search=${encodeURIComponent(destinationEmail)}&pageSize=100`,
    );
    const mailbox = results.data.find(
      (entry: { email: string }) =>
        entry.email.toLowerCase() === destinationEmail.toLowerCase(),
    );
    if (!mailbox)
      throw new Error("Destination must be an active hosted mailbox.");
    return this.request("/admin/aliases", {
      method: "POST",
      body: JSON.stringify({ sourceAddress, destinationMailboxId: mailbox.id }),
    });
  }

  async deleteAdminAlias(id: string) {
    return this.request(`/admin/aliases/${id}`, { method: "DELETE" });
  }

  async retryAdminJob(id: string) {
    return this.request(`/admin/jobs/${id}/retry`, { method: "POST" });
  }

  async listAdminJobs(page = 1, pageSize = 50, status?: string) {
    return this.request(
      `/admin/jobs?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ""}`,
    );
  }

  async listAdminAuditLogs(page = 1, pageSize = 50, action?: string) {
    return this.request(
      `/admin/audit-log?page=${page}&pageSize=${pageSize}${action ? `&action=${action}` : ""}`,
    );
  }
}

export const api = new ApiClient();
