export function durationSeconds(value: string, maximum: number): number {
  const match = /^(\d+)(s|m|h|d)?$/.exec(value);
  if (!match) throw new Error('Token lifetime must be a positive duration (e.g. 15m or 7d)');
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = Number(match[1]) * units[match[2] || 's'];
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > maximum) throw new Error('Token lifetime outside permitted range');
  return seconds;
}
export const accessTokenSeconds = () => durationSeconds(process.env.JWT_ACCESS_EXPIRY || '15m', 3600);
export const refreshTokenSeconds = () => durationSeconds(process.env.JWT_REFRESH_EXPIRY || '7d', 30 * 86400);
