"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import SubModal, { type Trade, type EditableSub } from "../SubModal";

/** "Edit sub" in the detail header — same form as Add, pre-filled. */
export default function EditSubButton({
  trades,
  sub,
}: {
  trades: Trade[];
  sub: EditableSub;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Pencil size={15} /> Edit sub
      </button>
      {open && <SubModal trades={trades} sub={sub} onClose={() => setOpen(false)} />}
    </>
  );
}
