FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Postfix with PostgreSQL map support
RUN apt-get update && apt-get install -y --no-install-recommends \
    postfix \
    postfix-pgsql \
    libsasl2-modules \
    ca-certificates \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Create vmail user/group
RUN groupadd -g 5000 vmail && \
    useradd -u 5000 -g vmail -d /var/vmail -s /sbin/nologin -M vmail && \
    mkdir -p /var/vmail && \
    chown vmail:vmail /var/vmail

# Copy configuration files
COPY main.cf /etc/postfix/main.cf
COPY master.cf /etc/postfix/master.cf
COPY pgsql-virtual-domains.cf /etc/postfix/pgsql-virtual-domains.cf
COPY pgsql-virtual-mailboxes.cf /etc/postfix/pgsql-virtual-mailboxes.cf
COPY pgsql-virtual-aliases.cf /etc/postfix/pgsql-virtual-aliases.cf
COPY pgsql-virtual-senders.cf /etc/postfix/pgsql-virtual-senders.cf

# Copy and set entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Postfix requires spool directories
RUN mkdir -p /var/spool/postfix/pid && \
    mkdir -p /var/spool/postfix/private

EXPOSE 25 465 587

ENTRYPOINT ["/entrypoint.sh"]
