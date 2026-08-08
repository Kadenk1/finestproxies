const nodes = [
  { x: 300, y: 90, label: "London" },
  { x: 470, y: 130, label: "Frankfurt" },
  { x: 130, y: 150, label: "New York" },
  { x: 90, y: 260, label: "São Paulo" },
  { x: 520, y: 260, label: "Tokyo" },
  { x: 380, y: 300, label: "Singapore" },
  { x: 210, y: 300, label: "Los Angeles" },
  { x: 440, y: 210, label: "Mumbai" },
];

const hub = { x: 300, y: 200 };

function curvePath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - 28;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

export function NetworkVisual() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <svg
        viewBox="0 0 600 400"
        className="w-full"
        role="img"
        aria-label="Visualization of global proxy gateway coverage across multiple continents"
      >
        <defs>
          <radialGradient id="globeFill" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="var(--brand-50)" />
            <stop offset="100%" stopColor="var(--brand-100)" stopOpacity="0.3" />
          </radialGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        <ellipse cx="300" cy="200" rx="220" ry="150" fill="url(#globeFill)" />

        {/* latitude / longitude grid to suggest a globe */}
        <g stroke="var(--brand-200)" strokeWidth="1" fill="none" opacity="0.7">
          <ellipse cx="300" cy="200" rx="220" ry="150" />
          <ellipse cx="300" cy="200" rx="220" ry="80" />
          <ellipse cx="300" cy="200" rx="220" ry="20" />
          <ellipse cx="300" cy="200" rx="150" ry="150" />
          <ellipse cx="300" cy="200" rx="70" ry="150" />
          <line x1="80" y1="200" x2="520" y2="200" />
        </g>

        {/* connections from hub to each node */}
        <g fill="none" strokeWidth="1.5">
          {nodes.map((n) => (
            <path
              key={`line-${n.label}`}
              d={curvePath(hub.x, hub.y, n.x, n.y)}
              stroke="url(#lineGrad)"
            />
          ))}
        </g>

        {/* hub */}
        <circle cx={hub.x} cy={hub.y} r="6" fill="var(--brand-600)" />
        <circle cx={hub.x} cy={hub.y} r="12" fill="var(--brand-400)" opacity="0.25" />

        {/* nodes */}
        {nodes.map((n, i) => (
          <g key={n.label}>
            <circle
              cx={n.x}
              cy={n.y}
              r="10"
              fill="var(--brand-400)"
              opacity="0.18"
              className="origin-center animate-pulse"
              style={{ animationDelay: `${i * 200}ms`, animationDuration: "3s" }}
            />
            <circle cx={n.x} cy={n.y} r="4" fill="var(--brand-600)" />
            <text
              x={n.x}
              y={n.y - 16}
              textAnchor="middle"
              className="fill-navy-700"
              style={{ fontSize: 11, fontWeight: 500 }}
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
