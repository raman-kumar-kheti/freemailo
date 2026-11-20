#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_DIR="$(mktemp -d "$ROOT_DIR/apps/api/.prisma-schema.XXXXXX")"
trap 'rm -rf "$SCHEMA_DIR"' EXIT
cp "$ROOT_DIR/prisma/schema.prisma" "$SCHEMA_DIR/schema.prisma"
"$ROOT_DIR/apps/api/node_modules/.bin/prisma" generate --schema "$SCHEMA_DIR/schema.prisma"
