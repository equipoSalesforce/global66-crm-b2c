import Image from "next/image";

export function Global66Mark({
  className = "h-9 w-9",
}: {
  className?: string;
}) {
  return (
    <span className={`g66-logo-mark overflow-hidden ${className}`} aria-hidden="true">
      <Image
        src="/brand/global66-icon.png"
        alt=""
        width={128}
        height={128}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
