import type { PlannerRow } from "@/lib/excel";

interface MatchableItem {
  itemCode: string;
  productionOrderNo: string;
}

/**
 * Same PPO + item code can appear as separate lines (e.g. two production
 * orders for the same item code). Production Order No is the true unique
 * identifier per line, so prefer matching on it when the row has a real one.
 * Rows with no PO number yet (blank or "Inventored") fall back to item-code
 * matching against items that don't already belong to a different PO line.
 */
export function findMatchingItem<T extends MatchableItem>(items: T[], row: PlannerRow): T | undefined {
  const po = row.productionOrderNo?.trim();
  const hasRealPO = !!po && po.toLowerCase() !== "inventored";

  if (hasRealPO) {
    const byPO = items.find(i => i.productionOrderNo === po);
    if (byPO) return byPO;
    return items.find(i => i.itemCode === row.itemCode && !i.productionOrderNo);
  }

  return items.find(
    i => i.itemCode === row.itemCode && (!i.productionOrderNo || i.productionOrderNo.toLowerCase() === "inventored")
  );
}
