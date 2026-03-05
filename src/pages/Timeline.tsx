import { useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { useEvents } from "../hooks/useEvents";
import TimelineBar from "../components/TimelineBar";
import EventCard from "../components/EventCard";

export default function Timeline() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { events, loading } = useEvents(dateStr);

  const isToday =
    format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Timeline
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Prev
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white min-w-32 text-center">
            {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </span>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            disabled={isToday}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
          >
            Next
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12">Loading...</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <TimelineBar events={events} />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              All Events ({events.length})
            </h3>
            <div className="space-y-2">
              {events.length > 0 ? (
                events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <p className="text-sm text-gray-400">
                  No events for this date.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
