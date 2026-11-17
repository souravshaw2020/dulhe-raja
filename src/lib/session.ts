export function getCartSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "dulhe_raja_cart_session";
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = `dr_${crypto.randomUUID()}`;
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export function formatINR(amount: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
