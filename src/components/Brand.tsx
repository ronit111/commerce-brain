// Apna Aisle wordmark — a simple leaf-in-a-basket mark rendered inline so the
// demo has no external asset dependencies. Restrained, grocery-forward.

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="var(--dk-green)" />
      {/* basket */}
      <path
        d="M8 15h16l-1.6 8.2a2 2 0 0 1-2 1.6H11.6a2 2 0 0 1-2-1.6L8 15Z"
        fill="#fff"
        fillOpacity="0.92"
      />
      {/* leaf */}
      <path
        d="M16 5.5c3.4 0 6 2.4 6 5.6 0 .5-.06 1-.17 1.4-.4-2.9-2.9-5-5.83-5-.5 0-1 .06-1.46.18C15.1 6.4 15.5 5.5 16 5.5Z"
        fill="var(--dk-amber)"
      />
      <path
        d="M16.4 6.6c2.9 0 5.2 2 5.6 4.9-2 .3-6.2.2-8.2-2.1.8-1.7 1.5-2.8 2.6-2.8Z"
        fill="var(--dk-green)"
      />
    </svg>
  );
}

export function BrandWord({ light = false }: { light?: boolean }) {
  return (
    <span
      className="font-semibold tracking-tight"
      style={{ color: light ? "#fff" : "var(--dk-ink)" }}
    >
      Apna<span style={{ color: light ? "var(--lens-green)" : "var(--dk-green)" }}> Aisle</span>
    </span>
  );
}
