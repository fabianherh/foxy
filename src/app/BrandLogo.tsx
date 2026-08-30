import Image from "next/image";

export function FoxyMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return <span className={`foxy-logo-mark ${className}`} style={{ width: size, height: size }}><Image src="/foxy-mark.svg" alt="" width={size} height={size} priority /></span>;
}

export function BrandLogo({ mode, size = "default" }: { mode?: string; size?: "default" | "large" }) {
  return <span className={`foxy-logo foxy-logo-${size}`}><FoxyMark size={size === "large" ? 76 : 34}/><span className="foxy-wordmark">Foxy</span>{mode && <span className="foxy-logo-mode">{mode}</span>}</span>;
}
