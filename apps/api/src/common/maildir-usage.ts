import { open } from "node:fs/promises";
import { join } from "node:path";

/** Dovecot maildirsize: quota header followed by signed byte/message deltas. */
export function parseMaildirUsage(contents: string): number | null {
  const lines = contents.trimEnd().split("\n");
  if (lines.length < 2 || !/^\d+S(?:,\d+C)?$/.test(lines.shift()!)) return null;
  let bytes = 0;
  for (const line of lines) {
    if (!/^-?\d+\s+-?\d+$/.test(line.trim())) return null;
    bytes += Number(line.trim().split(/\s+/)[0]);
    if (!Number.isSafeInteger(bytes)) return null;
  }
  return bytes >= 0 ? bytes : null;
}

export async function readMaildirUsage(
  domain: string,
  localPart: string,
): Promise<number | null> {
  if (
    !/^[a-z0-9.-]+$/i.test(domain) ||
    domain === "." ||
    domain === ".." ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(localPart)
  )
    return null;
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(
      join(
        process.env.VMAIL_ROOT || "/var/vmail",
        domain,
        localPart,
        "Maildir",
        "maildirsize",
      ),
      "r",
    );
    const buffer = Buffer.alloc(65537);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    // Do not turn missing, oversized or partially written counters into zero usage.
    if (bytesRead > 65536 || buffer[bytesRead - 1] !== 10) return null;
    return parseMaildirUsage(buffer.subarray(0, bytesRead).toString("utf8"));
  } catch {
    return null;
  } finally {
    await file?.close();
  }
}
