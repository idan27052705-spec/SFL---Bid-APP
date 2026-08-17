import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPANY, APP } from "@/app/config";

/**
 * The company's own details, read from the database.
 *
 * These used to live in app/config.ts, which meant Idan couldn't change
 * the office phone number without a code change. config.ts is now only
 * the fallback for anything not filled in yet, so an empty field never
 * puts a blank into an email.
 */
export type CompanyDetails = {
  id: string;
  name: string;
  region: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  licenseNumber: string;
  website: string;
  fromEmail: string;
  replyTo: string;
};

const fallback = (id: string): CompanyDetails => ({
  id,
  name: COMPANY.name,
  region: COMPANY.region,
  phone: COMPANY.phone,
  address: "",
  city: "",
  state: "",
  zip: "",
  licenseNumber: "",
  website: "",
  fromEmail: COMPANY.fromEmail,
  replyTo: COMPANY.replyTo,
});

/** Cached per request — several emails in one request shouldn't re-query. */
export const getCompany = cache(async function getCompany(
  companyId?: string
): Promise<CompanyDetails> {
  const admin = createAdminClient();

  const query = admin
    .from("companies")
    .select(
      "id, name, region, phone, address, city, state, zip, license_number, website, from_email, reply_to_email"
    );

  const { data } = companyId
    ? await query.eq("id", companyId).maybeSingle()
    : await query.limit(1).maybeSingle();

  if (!data) return fallback(companyId ?? "");

  return {
    id: data.id,
    name: data.name || COMPANY.name,
    region: data.region || COMPANY.region,
    phone: data.phone || COMPANY.phone,
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    licenseNumber: data.license_number || "",
    website: data.website || "",
    fromEmail: data.from_email || COMPANY.fromEmail,
    replyTo: data.reply_to_email || COMPANY.replyTo,
  };
});

/** One-line address, skipping whatever hasn't been filled in. */
export function companyAddress(c: CompanyDetails): string {
  const tail = [c.city, c.state].filter(Boolean).join(", ");
  return [c.address, [tail, c.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

/** The footer line at the bottom of every email and the portal. */
export function companyFooter(c: CompanyDetails): string {
  const where = companyAddress(c) || c.region;
  return [c.name, where, c.phone, c.licenseNumber && `Lic. ${c.licenseNumber}`]
    .filter(Boolean)
    .join(" · ");
}

export const portalDomain = APP.domain;
