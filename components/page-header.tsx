export function PageHeader({
  eyebrow = "CRM",
  title,
  description,
  action,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white shadow-sm ${compact ? "p-5" : "p-6"}`}>
      <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between ${compact ? "gap-3" : "gap-5"}`}>
        <div>
          {eyebrow ? <p className="text-sm font-semibold text-[var(--g66-accent-cyan)]">{eyebrow}</p> : null}
          <h1 className={`${eyebrow ? "mt-2" : ""} font-bold tracking-normal text-gray-950 ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
            {title}
          </h1>
          <p className={`max-w-2xl text-gray-600 ${compact ? "mt-1 text-sm leading-5" : "mt-3 text-base leading-7"}`}>
            {description}
          </p>
        </div>

        {action}
      </div>
    </section>
  );
}
