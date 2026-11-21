import { parseMaildirUsage, readMaildirUsage } from "./maildir-usage";

describe("maildir quota accounting", () => {
  it("includes deliveries and removals instead of a fixed UI estimate", () => {
    expect(parseMaildirUsage("1073741824S\n1024 2\n512 1\n-256 -1\n")).toBe(
      1280,
    );
  });
  it.each(["", "1024S\n", "1024S\ninvalid\n", "1024S\n-1 -1\n"])(
    "does not report corrupt counters as empty mailboxes: %s",
    (input) => {
      expect(parseMaildirUsage(input)).toBeNull();
    },
  );
  it("rejects traversal without accessing another mailbox", async () => {
    expect(await readMaildirUsage("example.test", "../bob")).toBeNull();
  });
});
