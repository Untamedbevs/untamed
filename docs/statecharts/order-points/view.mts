type Vars = {
  balance: number;
  ledger: number;
  credits: number;
  stored: boolean;
  redeemed: boolean;
  pc: Record<string, string>;
};

const START = 10;
const settled = (v: Vars) => Object.values(v.pc).every((p) => p === "done");

export const title = "A member's points while an order is credited and a reward is redeemed";

export const state = (v: Vars) => {
  let label = !v.stored ? "Order not saved yet" : v.credits === 0 ? "Order saved, no points yet" : v.credits === 1 ? "Order points added" : "Order points added twice";
  if (settled(v) && v.stored && v.credits === 0) label = "Order saved, points lost for good";
  if (v.redeemed) label += ", reward redeemed";
  if (settled(v) && v.balance > START + v.ledger) label += ", balance higher than the history (free points)";
  if (settled(v) && v.balance < START + v.ledger) label += ", balance lower than the history";
  return label;
};

export const group = (v: Vars) => (!v.stored ? "Waiting for the order" : v.credits === 0 ? "Order saved" : "Points added");

export const colors = {
  "Waiting for the order": "tan",
  "Order saved": "orange",
  "Points added": "teal",
};

export const step = (action: string, from: Vars, to: Vars) => {
  switch (action) {
    case "DeliveryReads":
      return "an order delivery starts and reads the balance";
    case "DeliveryInserts":
      return from.stored ? "another delivery finds the order already saved" : "the order is saved";
    case "DeliveryWritesLedger":
      return "the order's points go into the history";
    case "DeliveryWritesBalance":
      return "the balance is set to the balance read earlier plus the points";
    case "DeliveryCreditsAtomically":
      if (!from.stored) return "the order is saved and credited in one locked step";
      return from.credits === 0
        ? "a delivery finds the order saved without points and credits it in one locked step"
        : "another delivery finds the order already credited";
    case "RedeemReads":
      return "the member starts a redemption";
    case "RedeemWritesLedger":
      return "the reward's cost goes into the history";
    case "RedeemGuardedWrite":
      return to.redeemed ? "the balance had not changed, so the redemption saves" : "the balance changed, so the redemption is undone";
    case "RedeemAtomically":
      return "the member redeems in one locked step";
    case "Fails":
      return "the server stops partway";
    default:
      return null;
  }
};
