/**
 * Premium crown badge displayed on profile cards for premium users.
 *
 * Renders a small golden crown icon with a subtle background glow.
 */
export default function PremiumBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const sizeClasses = size === "md" ? "h-5 w-5 text-sm" : "h-4 w-4 text-xs";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-yellow-500/20 ${sizeClasses}`}
      title="Premium"
    >
      <svg
        className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"}
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ color: "#FFD700" }}
      >
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
      </svg>
    </span>
  );
}
