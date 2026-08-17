"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal, { ModalField } from "@/components/Modal";

const COUNTIES = ["Miami-Dade", "Broward", "Palm Beach", "Monroe", "Other"];

export type ProjectFields = {
  name: string;
  client: string;
  address: string;
  city: string;
  county: string;
  type: string;
  startDate: string;
  description: string;
};

const EMPTY: ProjectFields = {
  name: "",
  client: "",
  address: "",
  city: "",
  county: "Broward",
  type: "",
  startDate: "",
  description: "",
};

/**
 * One form for creating and editing a project — same fields either way,
 * so keeping two copies would only guarantee they drift apart.
 */
export default function ProjectModal({
  mode,
  shortId,
  initial,
  onClose,
}: {
  mode: "new" | "edit";
  shortId?: number;
  initial?: Partial<ProjectFields>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProjectFields>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof ProjectFields) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      delete n.form;
      return n;
    });
  };

  async function save() {
    if (!form.name.trim()) {
      setErrors({ name: "Project name is required." });
      return;
    }

    setBusy(true);
    const res =
      mode === "new"
        ? await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch(`/api/projects/${shortId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });

    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setErrors({ form: data.error || "Couldn't save. Try again." });
      return;
    }

    onClose();
    if (mode === "new") router.push(`/projects/${data.project.short_id}`);
    router.refresh();
  }

  return (
    <Modal
      title={mode === "new" ? "New project" : "Edit project"}
      subtitle={
        mode === "new"
          ? "You can fill in the rest later — only the name is required."
          : undefined
      }
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : mode === "new" ? "Create project" : "Save changes"}
          </button>
        </>
      }
    >
      <ModalField
        id="name"
        label="Project name"
        required
        value={form.name}
        onChange={set("name")}
        error={errors.name}
        placeholder="Las Olas Residences — Tower B"
      />

      <div className="fieldrow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ModalField id="client" label="Client" value={form.client} onChange={set("client")} placeholder="Waterline Development" />
        <ModalField id="type" label="Project type" value={form.type} onChange={set("type")} placeholder="Multifamily · 18 stories" />
      </div>

      <ModalField id="address" label="Address" value={form.address} onChange={set("address")} placeholder="401 E Las Olas Blvd" />

      <div className="fieldrow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <ModalField id="city" label="City" value={form.city} onChange={set("city")} />
        <ModalField id="county" label="County" value={form.county} onChange={set("county")} options={COUNTIES} />
        <ModalField id="startDate" label="Start date" type="date" value={form.startDate} onChange={set("startDate")} />
      </div>

      <ModalField
        id="description"
        label="Description"
        textarea
        value={form.description}
        onChange={set("description")}
        placeholder="Scope, site conditions, access notes — anything subs should know."
      />

      {errors.form && (
        <div style={{ fontSize: 13, color: "#b3261e" }} role="alert">
          {errors.form}
        </div>
      )}
    </Modal>
  );
}
