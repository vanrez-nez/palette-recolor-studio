export function FloatingBar({ ariaLabel, children, className = "", orientation = "vertical" }) {
  return (
    <div className={`floating-bar ${orientation} ${className}`} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
