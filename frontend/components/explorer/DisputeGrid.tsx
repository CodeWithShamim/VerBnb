"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DisputeCard, { type ExplorerDispute } from "./DisputeCard";

const PAGE_SIZE = 12;

/**
 * Responsive card grid with newest-first sort and show-more pagination.
 * Resets to the first page whenever the record set changes (new search,
 * filter change).
 */
export default function DisputeGrid({
  records,
}: {
  records: ExplorerDispute[];
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  // New result set (search or filter change) → back to the first page.
  const resetKey = records.map((r) => r.id).join("|");
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [resetKey]);

  const sorted = [...records].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );
  const shown = sorted.slice(0, visible);

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {shown.map((r, i) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04 }}
            >
              <DisputeCard record={r} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {sorted.length > visible && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="btn-ghost px-5 py-2.5 text-sm"
          >
            Show more ({sorted.length - visible} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
