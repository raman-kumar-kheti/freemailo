#!/usr/bin/env python3
"""Compatibility entry point: recovery tests use disposable resources only."""
import os
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit("Usage: python3 scripts/test-backup-restore.py /path/to/backup-directory")
script = Path(__file__).with_name("test-restore-isolated.sh")
os.execv("/bin/bash", ["bash", str(script), sys.argv[1]])
