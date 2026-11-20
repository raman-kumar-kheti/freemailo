import { vacationScript } from "./sieve.service";

describe("vacation Sieve generation", () => {
  it("escapes script strings and dot-stuffs multiline replies", () => {
    const script = vacationScript("alice@example.test", {
      isActive: true,
      subject: 'Away "today"',
      body: ".\nHello",
      startDate: "2026-11-20",
      endDate: "2026-11-22",
    });
    expect(script).toContain('Away \\"today\\"');
    expect(script).toContain("text:\r\n..\r\nHello\r\n.");
    expect(script).toContain("2026-11-20T00:00:00+00:00");
  });
  it("rejects reversed date ranges", () => {
    expect(() =>
      vacationScript("alice@example.test", {
        isActive: true,
        subject: "Away",
        body: "hello",
        startDate: "2026-12-01",
        endDate: "2026-11-20",
      }),
    ).toThrow("End date");
  });
});
