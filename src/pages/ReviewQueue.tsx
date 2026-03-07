import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useEvents } from "../hooks/useEvents";
import { api } from "../lib/tauri";
import { aggregateToWorkBlocks } from "../lib/workblocks";
import WorkBlockCard from "../components/WorkBlockCard";

export default function ReviewQueue() {
  const { events, loading, refresh } = useEvents();
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [reclassifying, setReclassifying] = useState(false);

  useEffect(() => {
    const unlisten = listen("events-changed", () => {
      refresh();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const blocks = aggregateToWorkBlocks(events);
  const pendingBlocks = blocks.filter((b) => !approvedIds.has(b.id));

  const handleApproved = useCallback((blockId: string) => {
    setApprovedIds((prev) => new Set(prev).add(blockId));
  }, []);

  const handleReclassify = async () => {
    setReclassifying(true);
    try {
      const count = await api.triggerBatchReclassify();
      if (count > 0) {
        setApprovedIds(new Set());
        refresh();
      }
    } catch (e) {
      console.error("Batch reclassify failed:", e);
    } finally {
      setReclassifying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-6 w-32 bg-[#1a1a2e] rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a40] space-y-3 animate-pulse">
            <div className="h-4 w-48 bg-[#22223a] rounded" />
            <div className="h-3 w-32 bg-[#22223a] rounded" />
            <div className="h-2 w-full bg-[#22223a] rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Review</h2>
          <p className="text-xs text-gray-500">
            {pendingBlocks.length === 0
              ? "All blocks confirmed"
              : `${pendingBlocks.length} work block${pendingBlocks.length !== 1 ? "s" : ""} to review`}
          </p>
        </div>
        <button
          onClick={handleReclassify}
          disabled={reclassifying}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          {reclassifying ? (
            <>
              <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              AI processing...
            </>
          ) : (
            "Reclassify (AI)"
          )}
        </button>
      </div>

      {pendingBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
            <span className="text-lg text-emerald-400">{"\u2713"}</span>
          </div>
          <p className="text-sm text-gray-400">All clear</p>
          <p className="text-xs text-gray-600 mt-1">
            Work blocks will appear here as you use your computer
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingBlocks.map((block) => (
            <WorkBlockCard
              key={block.id}
              block={block}
              onApproved={handleApproved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
