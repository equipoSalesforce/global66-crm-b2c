export function CaseQaNotesSection() {
  return (
    <div className="grid gap-3">
      <section className="rounded-lg border border-[var(--g66-border)] bg-white p-3">
        <h3 className="text-xs font-semibold text-[var(--g66-text-primary)]">Evaluación Total</h3>
        <p className="mt-2 text-xs text-[var(--g66-text-secondary)]">Sin evaluación registrada.</p>
      </section>
      <section className="rounded-lg border border-[var(--g66-border)] bg-white p-3">
        <h3 className="text-xs font-semibold text-[var(--g66-text-primary)]">Resumen feedback</h3>
        <p className="mt-2 text-xs text-[var(--g66-text-secondary)]">Sin feedback registrado.</p>
      </section>
    </div>
  );
}
