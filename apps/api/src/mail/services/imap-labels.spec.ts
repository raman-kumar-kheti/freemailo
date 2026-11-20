import { ImapFlow } from "imapflow";
import { ImapService } from "./imap.service";
import { RedisService } from "../../redis/redis.module";

jest.mock("imapflow", () => ({ ImapFlow: jest.fn() }));
jest.mock("jsdom", () => ({ JSDOM: jest.fn(() => ({ window: {} })) }));
jest.mock("dompurify", () => () => ({ sanitize: (html: string) => html }));

describe("IMAP label search for the webmail UI", () => {
  it("searches the stable label keyword and preserves pagination and unread filters", async () => {
    const release = jest.fn();
    const client = {
      connect: jest.fn(),
      logout: jest.fn(),
      getMailboxLock: jest.fn().mockResolvedValue({ release }),
      search: jest.fn().mockResolvedValue([1, 2, 3, 4]),
      fetch: jest.fn(async function* (
        _range: string,
        _query: unknown,
        _options: unknown,
      ) {
        yield {
          uid: 2,
          envelope: {
            subject: "Project update",
            from: [{ name: "Maya", address: "maya@example.test" }],
          },
          flags: new Set(["MailHive_label-projects", "\\Flagged"]),
          size: 100,
        };
      }),
    };
    (ImapFlow as unknown as jest.Mock).mockImplementation(() => client);
    const service = new ImapService({} as RedisService);
    const result = await service.searchMessages(
      "alice@example.test",
      "label:label-projects is:unread",
      "INBOX",
      2,
      2,
    );
    expect(client.search).toHaveBeenCalledWith(
      { keyword: "MailHive_label-projects", unseen: true },
      { uid: true },
    );
    expect(client.fetch.mock.calls[0][0]).toBe("2,1");
    expect(result.total).toBe(4);
    expect(result.data[0].labels).toEqual(["label-projects"]);
    expect(result.data[0].isStarred).toBe(true);
    expect(release).toHaveBeenCalled();
    expect(client.logout).toHaveBeenCalled();
  });
});
