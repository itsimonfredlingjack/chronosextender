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
      <div className="p-6 space-y-4">
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
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h2 className="text-xl font-semibold text-white">Review</h2>
          <p className="text-xs text-gray-400 mt-0.5">
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
            <>
              <span className="text-indigo-400">✦</span>
              Reclassify
            </>
          )}
        </button>
      </div>

      {pendingBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {/* Animated success state */}
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ring-pulse" />
            <div className="absolute inset-2 rounded-full bg-emerald-500/5 animate-ring-pulse" style={{ animationDelay: "1s" }} />
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-400">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>
          <p className="text-base font-medium text-gray-300">All clear</p>
          <p className="text-xs text-gray-500 mt-1.5 max-w-xs">
            Work blocks will appear here as you use your computer. Chronos groups related activity for easy review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingBlocks.map((block, i) => (
            <div
              key={block.id}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <WorkBlockCard
                block={block}
                onApproved={handleApproved}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
