/**
 * Marks the reminder cadence as a setting the app stores but does not
 * yet act on. Reminders only go out when someone sends them from the
 * dashboard's chase list or a bid's sub row.
 *
 * Delete this component and every usage of it the day the scheduled job
 * goes live — a label that outlives the thing it describes teaches
 * people to ignore all the other labels.
 */
export default function NotAutomatic() {
  return (
    <span
      className="tag tag-neutral"
      title="Nothing sends reminders on a schedule yet. The cadence is saved, and reminders go out when you send them yourself."
      style={{ letterSpacing: ".04em" }}
    >
      Not automatic yet
    </span>
  );
}
