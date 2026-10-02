"use client";

import { useEffect, useState } from "react";

/** 当前时间戳；首次渲染为 null（渲染期间不能调用 Date.now()），之后每 intervalMs 更新一次。 */
export function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [intervalMs]);
  return now;
}
