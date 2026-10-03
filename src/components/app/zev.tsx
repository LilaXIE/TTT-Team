"use client";

import { cn } from "cn";
import { useId } from "react";
import type { MockTask } from "@/lib/mock/types";

/** 产品状态。外观只落到设计稿的五种姿态。 */
export type ZevMood = "idle" | "search" | "wait" | "ask" | "deny" | "done" | "frozen";
export type ZevPose = "rest" | "look" | "ask" | "done" | "hold";

export const ZEV_POSES: { id: ZevPose; zh: string; en: string; when: { zh: string; en: string } }[] = [
  { id: "rest", zh: "REST", en: "REST", when: { zh: "首页待命", en: "Home, waiting" } },
  { id: "look", zh: "LOOK", en: "LOOK", when: { zh: "正在找、起草", en: "Searching or drafting" } },
  { id: "ask", zh: "ASK", en: "ASK", when: { zh: "先问你，或这笔不能买", en: "Needs you, or declined" } },
  { id: "done", zh: "DONE", en: "DONE", when: { zh: "买好了", en: "Paid" } },
  { id: "hold", zh: "HOLD", en: "HOLD", when: { zh: "即将付款，或账号冻结", en: "About to pay, or frozen" } },
];

const POSE: Record<ZevMood, ZevPose> = {
  idle: "rest",
  search: "look",
  ask: "ask",
  deny: "ask",
  done: "done",
  wait: "hold",
  frozen: "hold",
};

export function poseFor(mood: ZevMood): ZevPose {
  return POSE[mood];
}

export function moodForTask(task: MockTask, frozen: boolean): ZevMood {
  if (frozen) return "frozen";
  if (task.status === "running" || task.status === "drafting") return "search";
  const last = [...task.blocks].reverse().find((b) => b.kind !== "user" && b.kind !== "hint");
  if (!last) return task.status === "failed" ? "deny" : "idle";
  if (last.kind === "denied" || (last.kind === "pick" && (last.state === "denied" || last.state === "declined"))) return "deny";
  if (last.kind === "awaiting" || (last.kind === "pick" && last.state === "awaiting") || last.kind === "shortlist" || task.status === "awaiting_confirmation") return "ask";
  if (last.kind === "pick" && last.state === "offered") return "wait";
  if (last.kind === "receipt" || (last.kind === "pick" && last.state === "paid") || task.status === "completed") return "done";
  if (last.kind === "working" || last.kind === "curated") return "search";
  if (task.status === "failed") return "deny";
  return "idle";
}

export function ZevMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("inline-block shrink-0", className)} aria-hidden>
      <ZBody fill="#1c1b1f" />
    </svg>
  );
}

export function ZevCharacter({ mood = "idle", className }: { mood?: ZevMood; className?: string }) {
  const pose = poseFor(mood);
  const id = useId().replace(/:/g, "");
  return (
    <span className={cn("zev inline-block shrink-0", `zev-pose-${pose}`, `zev-mood-${mood}`, className)} aria-hidden>
      <svg viewBox="0 0 64 64" className="size-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="20" y1="8" x2="48" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#efe8ff" />
            <stop offset="0.42" stopColor="#d5c6f6" />
            <stop offset="1" stopColor="#b9a6ee" />
          </linearGradient>
        </defs>
        <ellipse className="zev-shadow" cx="32" cy="58" rx="16" ry="3" />
        <g className="zev-rig">
          <ZBody fill={`url(#${id})`} />
          <ellipse className="zev-shine" cx="42" cy="16" rx="8" ry="4.5" />
          <g className="zev-face">
            <path className="zev-brow zev-brow-l" d="M30 14.2c1.6-1.3 3.4-1.1 4.6.3" />
            <path className="zev-brow zev-brow-r" d="M39 13.8c1.5-1.2 3.2-1 4.4.4" />
            <g className="zev-eyes">
              <circle cx="33.2" cy="18.4" r="1.55" />
              <circle cx="41.2" cy="17.8" r="1.55" />
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}

function ZBody({ fill }: { fill: string }) {
  return (
    <path
      d="M16 20h30L18 44h30"
      fill="none"
      stroke={fill}
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
