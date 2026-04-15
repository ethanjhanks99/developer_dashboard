"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton(): React.JSX.Element {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync(): Promise<void> {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      // Poll until digest appears (up to 30s)
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch("/api/digest");
        if (res.ok) break;
      }
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {syncing ? "Syncing…" : "Sync now"}
    </button>
  );
}
