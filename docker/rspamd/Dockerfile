FROM ubuntu:24.04

LABEL maintainer="MailHive <admin@mailhive.io>"
LABEL description="Rspamd spam filtering system for MailHive email platform"

ENV DEBIAN_FRONTEND=noninteractive

# Install prerequisites
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Add the official Rspamd repository
RUN curl -fsSL https://rspamd.com/apt-stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/rspamd-archive-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/rspamd-archive-keyring.gpg] https://rspamd.com/apt-stable/ $(lsb_release -cs) main" \
        > /etc/apt/sources.list.d/rspamd.list

# Install Rspamd
RUN apt-get update && apt-get install -y --no-install-recommends \
    rspamd \
    && rm -rf /var/lib/apt/lists/*

# Create required directories
RUN mkdir -p \
    /etc/rspamd/local.d \
    /etc/rspamd/override.d \
    /var/lib/rspamd/dkim \
    /var/log/rspamd \
    /run/rspamd

# Copy local.d configuration overrides
COPY local.d/ /etc/rspamd/local.d/

# Copy override.d configuration overrides (directory may be empty initially)
COPY override.d/ /etc/rspamd/override.d/

# Copy and prepare entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set ownership so rspamd process can write runtime data
RUN chown -R _rspamd:_rspamd \
    /var/lib/rspamd \
    /var/log/rspamd \
    /run/rspamd

# Milter/proxy port and Web UI port
EXPOSE 11332 11334
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl --fail --silent --max-time 3 http://127.0.0.1:11334/ping || exit 1

ENTRYPOINT ["/entrypoint.sh"]
