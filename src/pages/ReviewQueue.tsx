import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useEvents } from "../hooks/useEvents";
import { aggregateToWorkBlocks } from "../lib/workblocks";
import WorkBlockCard from "../components/WorkBlockCard";

export default function ReviewQueue() {
  const { events, loading, refresh } = useEvents();
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
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
