export function PageHeader({
  eyebrow = "CRM",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--g66-accent-cyan)]">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-gray-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
            {description}
          </p>
        </div>

        {action}
      </div>
    </section>
  );
}
