import Image from "next/image";

export function FoxyMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return <span className={`foxy-logo-mark ${className}`} style={{ height: size, width: Math.round(size * 1.35) }}><Image src="/foxy-lockup.png" alt="Foxy" width={1470} height={1009} priority /></span>;
}

export function BrandLogo({ mode, size = "default" }: { mode?: string; size?: "default" | "large" }) {
  return <span className={`foxy-logo foxy-logo-${size}`}><Image className="foxy-wordmark-img" src="/foxy-wordmark.png" alt="Foxy" width={1200} height={281} priority />{mode && <span className="foxy-logo-mode">{mode}</span>}</span>;
}
