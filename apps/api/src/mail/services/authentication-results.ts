import type { AuthResultsDto } from "./imap.service";

// Split RFC 8601 clauses without interpreting semicolons inside comments or
// quoted property values. Malformed input fails closed.
function clauses(value: string): string[] {
  if (value.length > 65536) return [];
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      if (!depth) current += char;
      escaped = false;
    } else if (char === "\\" && (quoted || depth)) {
      escaped = true;
    } else if (depth) {
      if (char === "(") depth++;
      if (char === ")") depth--;
    } else if (char === '"') {
      quoted = !quoted;
      current += char;
    } else if (!quoted && char === "(") {
      depth = 1;
      current += " ";
    } else if (!quoted && char === ")") {
      return [];
    } else if (!quoted && char === ";") {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  return depth || quoted || escaped ? [] : [...result, current.trim()];
}

export function trustedAuthenticationResults(
  headers: string[],
  hostname: string | undefined,
): AuthResultsDto {
  const result: AuthResultsDto = { spf: "none", dkim: "none", dmarc: "none" };
  const trustedHost = hostname?.toLowerCase().replace(/\.$/, "");
  if (!trustedHost) return result;
  for (const header of headers) {
    const [issuer, ...methods] = clauses(header.replace(/\r?\n[\t ]+/g, " "));
    if (issuer?.toLowerCase().replace(/\.$/, "") !== trustedHost) continue;
    for (const method of methods) {
      const match =
        /^(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none)(?:\s|$)/i.exec(
          method,
        );
      if (!match) continue;
      const name = match[1].toLowerCase();
      const value = match[2].toLowerCase();
      if (name === "spf") result.spf = value as AuthResultsDto["spf"];
      else if (value === "pass" || value === "fail" || value === "none") {
        result[name as "dkim" | "dmarc"] = value;
      }
    }
    // Never merge foreign or duplicate headers into the local result.
    return result;
  }
  return result;
}
