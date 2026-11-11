// The dashboard's logo: a simple globe drawn for this project (circle, equator,
// two lines of latitude and a meridian ellipse). Same artwork as public/favicon.svg.
export default function Logo({ size = 44 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22" fill="#2D7DD2" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="24" cy="24" r="15.5" />
        <ellipse cx="24" cy="24" rx="7" ry="15.5" />
        <path d="M8.5 24h31M11 16h26M11 32h26" />
      </g>
    </svg>
  )
}
