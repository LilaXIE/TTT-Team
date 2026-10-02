export function SectionTag({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{children}</span>;
}

export function MockBanner({ children }: { children?: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
      示例数据：{children ?? "阶段 2 接口接通前用于预览页面。"}
    </p>
  );
}
