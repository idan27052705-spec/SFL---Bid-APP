"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import Modal from "@/components/Modal";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

/**
 * "Send again to all" — chases every sub on THIS package who hasn't
 * priced it. Uses the same rules as the dashboard nudge: anyone who
 * already answered or declined is skipped.
 */
export default function SendAllButton({ quietCount }: { quietCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    const res = await fetch("/api/invitations/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 0 }),
    });
    const data = await res.json();
    setBusy(false);
    setConfirming(false);
    setResult(
      res.ok
        ? `Reminder sent to ${data.sent} sub${data.sent === 1 ? "" : "s"}.` +
            (data.failed?.length ? ` Couldn't reach: ${data.failed.join(", ")}.` : "")
        : data.error || "Couldn't send."
    );
    router.refresh();
  }

  if (quietCount === 0) return null;

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setConfirming(true)}>
        <Send size={15} /> Send again to all
      </button>

      {confirming && (
        <Modal
          title="Send a reminder to everyone still quiet?"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={send} disabled={busy}>
                {busy ? "Sending…" : "Send reminders"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, margin: 0 }}>
            Every sub who hasn&apos;t sent a price yet gets the reminder email
            again, with their access code and a link straight into the bid.
          </p>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Anyone who already priced it or said they can&apos;t bid is skipped.
          </p>
        </Modal>
      )}

      {result && (
        <Modal
          title="Reminders sent"
          onClose={() => setResult(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setResult(null)}>
              Done
            </button>
          }
        >
          <p style={{ fontSize: 14, margin: 0 }}>{result}</p>
        </Modal>
      )}
    </>
  );
}
