import { AuthService } from "./auth.service";
import { durationSeconds } from "./token-lifetime";

describe("refresh rotation", () => {
  it("issues exactly one successor for simultaneous use of a refresh token", async () => {
    let claimed = false;
    const record = {
      id: "old",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      adminUserId: "admin",
      adminUser: { id: "admin", email: "admin@example.test", role: "ADMIN" },
    };
    const created = jest.fn();
    const prisma = {
      refreshToken: { findUnique: jest.fn().mockResolvedValue(record) },
      $transaction: async (fn: any) =>
        fn({
          refreshToken: {
            updateMany: async () => {
              if (claimed) return { count: 0 };
              claimed = true;
              return { count: 1 };
            },
            create: created,
          },
        }),
    };
    const auth = new AuthService(
      prisma as any,
      { sign: () => "jwt" } as any,
      {} as any,
    );
    const outcomes = await Promise.allSettled([
      auth.refreshTokens("opaque"),
      auth.refreshTokens("opaque"),
    ]);
    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(created).toHaveBeenCalledTimes(1);
  });
  it("rejects refresh when the owner domain is inactive", async () => {
    const prisma = {
      refreshToken: {
        findUnique: async () => ({
          expiresAt: new Date(Date.now() + 60000),
          mailboxId: "mailbox",
          mailbox: { isActive: true, domain: { isActive: false } },
        }),
      },
    };
    const auth = new AuthService(prisma as any, {} as any, {} as any);
    await expect(auth.refreshTokens("opaque")).rejects.toThrow("inactive");
  });
  it("validates duration units and enforces the access-token maximum", () => {
    expect(durationSeconds("15m", 3600)).toBe(900);
    expect(() => durationSeconds("100d", 3600)).toThrow();
    expect(() => durationSeconds("-1m", 3600)).toThrow();
  });
});
