import { trustedAuthenticationResults as parse } from "./authentication-results";

const host = "mail.example.test";
const none = { spf: "none", dkim: "none", dmarc: "none" };

describe("trusted Authentication-Results", () => {
  it("uses only the configured receiving server", () => {
    expect(
      parse(["attacker.invalid; spf=pass; dkim=pass; dmarc=pass"], host),
    ).toEqual(none);
    expect(parse([`${host}.attacker.invalid; spf=pass`], host)).toEqual(none);
    expect(parse([`${host}; spf=pass`], undefined)).toEqual(none);
  });
  it("parses folded local results independently of other headers", () => {
    expect(
      parse(
        [
          "attacker.invalid; spf=pass",
          `MAIL.EXAMPLE.TEST.;\r\n\tspf=softfail smtp.mailfrom=x; dkim=fail; dmarc=fail`,
        ],
        host,
      ),
    ).toEqual({ spf: "softfail", dkim: "fail", dmarc: "fail" });
  });
  it("does not interpret comments or quoted values as results", () => {
    expect(
      parse(
        [
          `${host}; spf=fail (nested (note); dkim=pass); dmarc=fail reason="claimed; dkim=pass"`,
        ],
        host,
      ),
    ).toEqual({ spf: "fail", dkim: "none", dmarc: "fail" });
  });
  it.each([
    "spf=passing",
    "spf=pass (unclosed",
    'spf=pass reason="unclosed',
    "spf=pass )",
  ])("fails closed on malformed results: %s", (value) => {
    expect(parse([`${host}; ${value}`], host)).toEqual(none);
  });
  it("does not merge duplicate local results", () => {
    expect(
      parse([`${host}; dmarc=fail`, `${host}; dmarc=pass`], host).dmarc,
    ).toBe("fail");
  });
});
