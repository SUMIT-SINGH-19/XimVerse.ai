import Image from "next/image";
import logo from "../../public/ximverse-logo-trimmed.png";

/**
 * The Ximverse logo. Its teal lettering needs a light backdrop, so place it on
 * a white surface even in dark mode.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt="Ximverse"
      priority
      className={`h-10 w-auto sm:h-12 ${className}`}
    />
  );
}
