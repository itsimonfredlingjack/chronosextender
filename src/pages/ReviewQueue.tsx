import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import PageTopStrip from "../components/PageTopStrip";
import WorkBlockCard from "../components/WorkBlockCard";
import ManualTimeEntryCard from "../components/ManualTimeEntryCard";
import RuleSuggestions from "../components/RuleSuggestions";
import { useCommandDeckState } from "../hooks/useCommandDeckState";
import { api } from "../lib/tauri";
import type { Event, ManualTimeEntry, NewManualTimeEntry } from "../lib/types";
import { aggregateToReviewWorkBlocks } from "../lib/workblocks";

export default function ReviewQueue() {
  const { visualState, statusLabel } = useCommandDeckState();
  const [events, setEvents] = useState<Event[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [reclassifying, setReclassifying] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [pendingEvents, pendingManualEntries] = await Promise.all([
        api.getPendingEvents(),
        api.getPendingManualTimeEntries(),
      ]);
      setEvents(pendingEvents);
      setManualEntries(pendingManualEntries);
    } catch (e) {
      console.error("Failed to load pending events:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = listen("events-changed", () => {
      void refresh();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  const blocks = aggregateToReviewWorkBlocks(events);
  const pendingBlocks = blocks.filter((b) => !approvedIds.has(b.id));
  const attentionCount = pendingBlocks.length + manualEntries.length;

  const handleApproved = useCallback((blockId: string) => {
    setApprovedIds((prev) => new Set(prev).add(blockId));
  }, []);

  const handleSaveManualEntry = useCallback(
    async (id: number, entry: NewManualTimeEntry) => {
      await api.updateManualTimeEntry(id, entry);
      await refresh();
    },
    [refresh]
  );

  const handleApproveManualEntry = useCallback(
    async (id: number) => {
      await api.setManualTimeEntryStatus(id, "approved");
      await refresh();
    },
    [refresh]
  );

  const handleExcludeManualEntry = useCallback(
    async (id: number) => {
      await api.setManualTimeEntryStatus(id, "excluded");
      await refresh();
    },
    [refresh]
  );

  const handleDeleteManualEntry = useCallback(
    async (id: number) => {
      await api.deleteManualTimeEntry(id);
      await refresh();
    },
    [refresh]
  );

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
        <div className="h-6 w-32 bg-[var(--color-card)] rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[var(--color-card)] rounded-xl p-5 border border-[var(--color-border)] space-y-3 animate-pulse">
            <div className="h-4 w-48 bg-[var(--color-elevated)] rounded" />
            <div className="h-3 w-32 bg-[var(--color-elevated)] rounded" />
            <div className="h-2 w-full bg-[var(--color-elevated)] rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <PageTopStrip
        title="Review"
        subtitle={
          attentionCount === 0
            ? "Nothing needs attention"
            : `${attentionCount} item${attentionCount !== 1 ? "s" : ""} need attention`
        }
        visualState={visualState}
        statusLabel={statusLabel}
        rightSlot={(
          <button
            onClick={handleReclassify}
            disabled={reclassifying}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            {reclassifying ? (
              <>
                <span className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
                AI is rechecking...
              </>
            ) : (
              <>
                <span className="text-indigo-400">✦</span>
                Try AI Again
              </>
            )}
          </button>
        )}
      />

      <RuleSuggestions />

      {attentionCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {/* Animated success state */}
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ring-pulse" />
            <div className="absolute inset-2 rounded-full bg-emerald-500/5 animate-ring-pulse" style={{ animationDelay: "1s" }} />
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-600">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>
          <p className="text-base font-medium text-slate-700">All clear</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs">
            New unresolved work blocks will appear here as you use your computer. Chronos only shows items that still need attention before export.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {pendingBlocks.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Captured work blocks</h3>
                <span className="text-xs text-slate-500">
                  {pendingBlocks.length} block{pendingBlocks.length !== 1 ? "s" : ""}
                </span>
              </div>
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
            </section>
          ) : null}

          {manualEntries.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Manual entries</h3>
                <span className="text-xs text-slate-500">
                  {manualEntries.length} entr{manualEntries.length === 1 ? "y" : "ies"}
                </span>
              </div>
              {manualEntries.map((entry) => (
                <ManualTimeEntryCard
                  key={entry.id}
                  entry={entry}
                  onSave={handleSaveManualEntry}
                  onApprove={handleApproveManualEntry}
                  onExclude={handleExcludeManualEntry}
                  onDelete={handleDeleteManualEntry}
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
