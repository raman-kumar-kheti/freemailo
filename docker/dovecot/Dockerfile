FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Dovecot with all required plugins
RUN apt-get update && apt-get install -y --no-install-recommends \
    dovecot-core \
    dovecot-imapd \
    dovecot-lmtpd \
    dovecot-pgsql \
    dovecot-sieve \
    dovecot-managesieved \
    ca-certificates \
    gettext-base \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create vmail user/group
RUN groupadd -g 5000 vmail && \
    useradd -u 5000 -g vmail -d /var/vmail -s /sbin/nologin -M vmail && \
    mkdir -p /var/vmail && \
    chown -R vmail:vmail /var/vmail

# Create sieve directories
RUN mkdir -p /etc/dovecot/sieve/global

# Copy configuration files
COPY dovecot.conf /etc/dovecot/dovecot.conf
COPY conf.d/ /etc/dovecot/conf.d/
COPY dovecot-sql.conf.ext /etc/dovecot/dovecot-sql.conf.ext
COPY sieve/ /etc/dovecot/sieve/

# Copy and set entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 993 24 4190 12345

ENTRYPOINT ["/entrypoint.sh"]
