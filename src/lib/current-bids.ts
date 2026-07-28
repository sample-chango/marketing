export const CURRENT_BID_SETTINGS_KEY = "current_bid_map";

export interface CurrentBidKeyInput {
  period_start?: string | null;
  period_end?: string | null;
  category?: string | null;
  campaign?: string | null;
  ad_group?: string | null;
  keyword?: string | null;
}

export function currentBidKey(input: CurrentBidKeyInput): string {
  return JSON.stringify([
    input.period_start ?? "",
    input.period_end ?? "",
    input.category ?? "",
    input.campaign ?? "",
    input.ad_group ?? "",
    input.keyword ?? "",
  ]);
}

export function periodKeyFromCurrentBidKey(key: string): string | null {
  try {
    const parts = JSON.parse(key) as unknown;
    if (!Array.isArray(parts) || parts.length < 2) return null;
    const start = typeof parts[0] === "string" ? parts[0] : "";
    const end = typeof parts[1] === "string" ? parts[1] : "";
    return `${start}~${end}`;
  } catch {
    return null;
  }
}

export function parseCurrentBidMap(value: string | null | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    const source =
      parsed && typeof parsed === "object" && "bids" in parsed
        ? (parsed as { bids?: unknown }).bids
        : parsed;
    if (!source || typeof source !== "object" || Array.isArray(source)) return {};
    const bids: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(source as Record<string, unknown>)) {
      const bid = Number(rawValue);
      if (Number.isFinite(bid) && bid > 0) bids[key] = bid;
    }
    return bids;
  } catch {
    return {};
  }
}

export function serializeCurrentBidMap(bids: Record<string, number>): string {
  return JSON.stringify({ version: 1, bids });
}
