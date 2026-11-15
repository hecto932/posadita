const COLORS = ['#e4007c', '#ff7a00', '#00a86b', '#6b2fd6', '#ffc400', '#00a3e0'];

/** Tira de papel picado colgando de un hilo. SVG puro, sin imágenes. */
export function PapelPicado() {
  const flags = Array.from({ length: 14 });
  const w = 70;
  return (
    <div aria-hidden className="pointer-events-none w-full overflow-hidden">
      <svg viewBox={`0 0 ${flags.length * w} 64`} preserveAspectRatio="xMidYMin slice" className="h-12 w-full sm:h-16">
        <defs>
          <mask id="picado" maskUnits="userSpaceOnUse">
            <rect width={w} height="64" fill="white" />
            {/* recortes */}
            <circle cx={w / 2} cy="24" r="7" fill="black" />
            <path d={`M${w / 2} 6 l4 6 -4 6 -4 -6z`} fill="black" />
            <circle cx="14" cy="16" r="3" fill="black" />
            <circle cx={w - 22} cy="16" r="3" fill="black" />
            <path d={`M10 36 q6 -6 12 0 q6 6 12 0 q6 -6 12 0`} stroke="black" strokeWidth="3" fill="none" />
            {/* orilla ondulada */}
            {Array.from({ length: 6 }).map((_, i) => (
              <circle key={i} cx={6 + i * 10.4} cy="52" r="4.5" fill="black" />
            ))}
          </mask>
        </defs>
        <path d={`M0 4 Q ${(flags.length * w) / 2} 10 ${flags.length * w} 4`} stroke="#8a6a55" strokeWidth="1.5" fill="none" />
        {flags.map((_, i) => (
          <g key={i} transform={`translate(${i * w + 4} ${5 + Math.sin(i * 1.3) * 1.5}) rotate(${(i % 2 ? 1 : -1) * 1.2} ${w / 2} 0)`}>
            <rect width={w - 8} height="52" rx="2" fill={COLORS[i % COLORS.length]} mask="url(#picado)" opacity="0.92" />
          </g>
        ))}
      </svg>
    </div>
  );
}
