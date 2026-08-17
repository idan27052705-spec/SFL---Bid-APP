/**
 * Marks a feature that is built and stored but not yet wired to its
 * provider — currently only SMS, which waits on Twilio.
 *
 * Remove every usage of this when the provider goes live; leaving it up
 * after the fact would be worse than never showing it, because people
 * stop believing the labels.
 */
export default function NotConnected({ what = "SMS" }: { what?: string }) {
  return (
    <span
      className="tag tag-neutral"
      title={`${what} sending isn't switched on yet. Everything here is saved and ready for when it is.`}
      style={{ letterSpacing: ".04em" }}
    >
      Not connected yet
    </span>
  );
}
