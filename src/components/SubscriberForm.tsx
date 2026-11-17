"use client";

import { FormEvent, useState } from "react";
import styles from "@/app/page.module.css";

export default function SubscriberForm() {
  const [phone, setPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, whatsappOptIn, smsOptIn }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFeedback(data.error || "Could not subscribe.");
      } else {
        setFeedback(
          "Subscribed! You will receive new category arrivals and festive offers.",
        );
        setPhone("");
      }
    } catch {
      setFeedback("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.newsletter}>
      <div className={styles.eyebrow}>A note from Dulhe Raja</div>
      <h2>Good things are worth dressing for.</h2>
      <p>
        Get first looks at new category arrivals, festive edits, and special
        offers.
      </p>

      <form className={styles.newsletterForm} onSubmit={handleSubmit}>
        <input
          type="tel"
          required
          placeholder="Your WhatsApp / mobile number (e.g. 9876543210)"
          aria-label="Your mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Keep me posted ↗"}
        </button>
      </form>

      <div className={styles.newsletterChecks}>
        <label>
          <input
            type="checkbox"
            checked={whatsappOptIn}
            onChange={(e) => setWhatsappOptIn(e.target.checked)}
          />
          WhatsApp
        </label>
        <label>
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={(e) => setSmsOptIn(e.target.checked)}
          />
          SMS
        </label>
      </div>

      {feedback && (
        <p
          style={{
            marginTop: "12px",
            fontSize: "12px",
            color: "var(--site-primary)",
          }}
        >
          {feedback}
        </p>
      )}
    </section>
  );
}
