import { Resend } from "resend";
import { COMPANY, APP } from "@/app/config";

/**
 * Email sending.
 *
 * Templates live in the database (`email_templates`) so Idan can edit the
 * wording without a code change. Merge fields are {curly} placeholders —
 * anything unknown is left alone rather than replaced with "undefined",
 * so a typo in a template shows up as {typo} instead of silently
 * corrupting the message.
 */

export type MergeFields = Record<string, string | number | null | undefined>;

const resend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
};

export function renderTemplate(text: string, fields: MergeFields): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = fields[key];
    return value == null || value === "" ? whole : String(value);
  });
}

/** Plain text -> simple, readable HTML. No marketing chrome. */
function toHtml(text: string, portalUrl?: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withLinks = portalUrl
    ? escaped.replace(
        portalUrl,
        `<a href="${portalUrl}" style="color:#416180">${portalUrl}</a>`
      )
    : escaped;

  return `<!doctype html><html><body style="margin:0;background:#f2f2f3">
<div style="max-width:560px;margin:0 auto;padding:28px 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d1f20">
<div style="font-weight:700;letter-spacing:.06em;font-size:13px;text-transform:uppercase;color:#597ea3;padding-bottom:14px;border-bottom:1px solid #d4d4d7;margin-bottom:18px">${COMPANY.name}</div>
<div style="white-space:pre-wrap">${withLinks}</div>
<div style="margin-top:26px;padding-top:14px;border-top:1px solid #d4d4d7;font-size:12px;color:#7a7a7d">
${COMPANY.name} · ${COMPANY.region} · ${COMPANY.phone}<br>${APP.domain}
</div>
</div></body></html>`;
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  text,
  portalUrl,
}: {
  to: string;
  subject: string;
  text: string;
  portalUrl?: string;
}): Promise<SendResult> {
  try {
    const { data, error } = await resend().emails.send({
      from: process.env.EMAIL_FROM || `${COMPANY.name} <${COMPANY.fromEmail}>`,
      replyTo: process.env.EMAIL_REPLY_TO || COMPANY.replyTo,
      to,
      subject,
      text,
      html: toHtml(text, portalUrl),
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || `https://${APP.domain}`;
