import { cn } from "cn";

export function AgentBubble({
  thinking = false,
  size = 48,
  className,
}: {
  thinking?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={thinking ? "Agent 思考中" : "Agent"}
      aria-busy={thinking}
      data-thinking={thinking}
      className={cn("agent-bubble", className)}
      style={{ width: size, height: size, "--bubble-size": `${size}px` } as React.CSSProperties}
    >
      <span className="agent-bubble__fog" aria-hidden>
        <span className="agent-bubble__wisp agent-bubble__wisp--a" />
        <span className="agent-bubble__wisp agent-bubble__wisp--b" />
        <span className="agent-bubble__wisp agent-bubble__wisp--c" />
      </span>
      <span className="agent-bubble__rim" aria-hidden />
      <span className="agent-bubble__shine" aria-hidden />
    </span>
  );
}
