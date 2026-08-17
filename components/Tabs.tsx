"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * The underlined uppercase tab row from the design.
 * State lives in the URL (?tab=costs) so a tab can be linked and survives
 * a refresh.
 */
export default function Tabs({
  tabs,
  current,
}: {
  tabs: readonly (readonly [string, string])[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (key: string) => {
    const next = new URLSearchParams(params.toString());
    if (key === tabs[0][0]) next.delete("tab");
    else next.set("tab", key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="tabstrip" style={{ marginTop: 14, display: "flex" }}>
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className="tab"
          aria-current={current === key ? "page" : undefined}
          onClick={() => go(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
