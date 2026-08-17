"use client";

import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import ProjectModal from "./projects/ProjectModal";
import SubModal, { type Trade } from "./subs/SubModal";

/** The two header buttons on the dashboard, each opening its modal. */
export default function DashboardActions({ trades }: { trades: Trade[] }) {
  const [open, setOpen] = useState<"project" | "sub" | null>(null);

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen("sub")}>
        <UserPlus size={15} /> Add sub
      </button>
      <button className="btn btn-primary blueprint" onClick={() => setOpen("project")}>
        <Plus size={15} /> New project
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
      </button>

      {open === "project" && <ProjectModal mode="new" onClose={() => setOpen(null)} />}
      {open === "sub" && <SubModal trades={trades} onClose={() => setOpen(null)} />}
    </>
  );
}
