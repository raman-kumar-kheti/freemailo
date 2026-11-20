import { csrfProtection } from "./security";
import { publicResponse } from "./response.interceptor";

describe("HTTP security boundaries", () => {
  it("removes credential fields from nested responses and serializes bigint", () => {
    expect(
      publicResponse({
        passwordHash: "secret",
        domain: { dkimPrivateKey: "key", name: "example.test" },
        quota: 1n,
      }),
    ).toEqual({ domain: { name: "example.test" }, quota: "1" });
  });
  it.each([
    ["POST", "https://attacker.test", {}, {}, false],
    ["POST", undefined, { access_token: "token" }, {}, false],
    [
      "POST",
      undefined,
      { access_token: "token" },
      { "x-requested-with": "MailHive" },
      true,
    ],
    ["POST", undefined, {}, { authorization: "Bearer token" }, true],
    ["GET", undefined, { access_token: "token" }, {}, true],
  ])(
    "checks %s origin %s and cookie CSRF requirements",
    (method, origin, cookies, headers, allowed) => {
      const next = jest.fn();
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      csrfProtection(
        {
          method,
          cookies,
          get: (key: string) => (key === "origin" ? origin : headers[key]),
        } as any,
        res as any,
        next,
      );
      expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
      if (!allowed) expect(res.status).toHaveBeenCalledWith(403);
    },
  );
});
