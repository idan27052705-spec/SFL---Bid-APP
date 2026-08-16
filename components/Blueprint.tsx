/**
 * The framed box from the design — a hairline border with registration
 * marks at each corner, like a drawing sheet. Used for every panel on
 * the detail screens.
 */
export default function Blueprint({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={`blueprint ${className}`} style={style}>
      {children}
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </div>
  );
}
