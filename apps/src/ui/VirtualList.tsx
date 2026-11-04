import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from './cn.ts';

/**
 * Scrollable list that only renders the rows in view (lists of 100+ rows:
 * collected users, send log). Rows may have different heights; each is measured.
 * The element needs a bounded height (flex-1 min-h-0, or max-h-*).
 */
export function VirtualList<T>({ items, getKey, renderItem, estimateSize, label, overscan = 8, className }: {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Typical row height in px, before measuring. */
  estimateSize: number;
  /** Accessible name of the list. */
  label: string;
  overscan?: number;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => estimateSize,
    getItemKey: index => getKey(items[index]!, index),
    overscan,
  });

  return (
    <div ref={scroller} role="list" aria-label={label} className={cn('min-h-0 overflow-y-auto', className)}>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(row => (
          <div
            key={row.key}
            role="listitem"
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {renderItem(items[row.index]!, row.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
