const shimmer = {
  background: "linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
} as const;

export function SkeletonBox({ width, height, radius = 6 }: { width?: number | string; height: number; radius?: number }) {
  return (
    <div style={{ ...shimmer, width: width ?? "100%", height, borderRadius: radius, flexShrink: 0 }} />
  );
}

export function SkeletonTableRow({ cols }: { cols: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: "14px 16px", borderBottom: "1px solid #F5F5F5", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <SkeletonBox height={13} width="60%" />
        <SkeletonBox height={11} width="40%" />
      </div>
      <SkeletonBox height={20} width={70} radius={4} />
      <SkeletonBox height={20} width={80} radius={4} />
      <SkeletonBox height={13} width={90} />
      <SkeletonBox height={13} width={60} />
      <SkeletonBox height={13} width={50} />
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, padding: "16px 20px" }}>
      <SkeletonBox height={12} width={80} />
      <div style={{ marginTop: 10 }}>
        <SkeletonBox height={28} width={50} />
      </div>
    </div>
  );
}

export function SkeletonListRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #F5F5F5" }}>
      <SkeletonBox height={32} width={32} radius={16} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <SkeletonBox height={13} width="50%" />
        <SkeletonBox height={11} width="30%" />
      </div>
      <SkeletonBox height={20} width={70} radius={4} />
    </div>
  );
}

export function SkeletonPage({ rows = 5, cols = "1fr 110px 110px 120px 90px 70px" }: { rows?: number; cols?: string }) {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      <div style={{ backgroundColor: "white", border: "1px solid #EFEFEF", borderRadius: 14, overflow: "hidden" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </div>
    </>
  );
}
