"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Upload one file, from the browser straight to storage.
 *
 * Why not just POST it to an API route: Vercel caps a request body at
 * 4.5 MB, so a real plan set (10–30 MB) fails with a 413 before any of
 * our code runs. So the server only signs the upload and records it
 * afterwards; the bytes go browser → Supabase directly.
 *
 * HEIC is converted to JPEG here, in the browser. An iPhone shoots HEIC
 * by default and no browser but Safari can draw it — so if we stored the
 * original, neither the office nor the sub could see the photo. The
 * converter is a big library, so it's only fetched when a HEIC actually
 * turns up.
 */

const isHeic = (file: File) =>
  /\.(heic|heif)$/i.test(file.name) ||
  file.type === "image/heic" ||
  file.type === "image/heif";

async function toJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const converted = (await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.85,
  })) as Blob;

  const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([converted], name, { type: "image/jpeg" });
}

export type UploadTarget = {
  projectShortId: number;
  /** Also links the file to this bid package. */
  bidShortId?: number;
};

export type UploadedFile = {
  id: string;
  name: string;
  kind: string;
  size_bytes: number | null;
};

export async function uploadFile(
  original: File,
  target: UploadTarget,
  onStage?: (stage: "converting" | "uploading" | "saving") => void
): Promise<{ ok: true; file: UploadedFile } | { ok: false; error: string }> {
  let file = original;

  if (isHeic(file)) {
    onStage?.("converting");
    try {
      file = await toJpeg(file);
    } catch {
      return {
        ok: false,
        error:
          "couldn't convert that HEIC photo — set your iPhone camera to Most Compatible, or send a JPEG",
      };
    }
  }

  // 1. ask the server where this goes
  onStage?.("uploading");
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectShortId: target.projectShortId,
      name: file.name,
      size: file.size,
    }),
  });
  const sign = await signRes.json();
  if (!signRes.ok) return { ok: false, error: sign.error || "couldn't start the upload" };

  // 2. send the bytes straight to storage
  const supabase = createClient();
  const { error: upErr } = await supabase.storage
    .from("bid-files")
    .uploadToSignedUrl(sign.path, sign.token, file, {
      contentType: file.type || undefined,
    });

  if (upErr) return { ok: false, error: upErr.message || "upload failed" };

  // 3. tell the server it landed
  onStage?.("saving");
  const confirmRes = await fetch("/api/uploads/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: sign.path,
      name: file.name,
      size: file.size,
      mime: file.type,
      projectShortId: target.projectShortId,
      bidShortId: target.bidShortId,
    }),
  });
  const confirm = await confirmRes.json();
  if (!confirmRes.ok) return { ok: false, error: confirm.error || "couldn't save the file" };

  return { ok: true, file: confirm.file };
}
