create extension if not exists pgcrypto;

create table if not exists public.case_area_layouts (
  id uuid primary key default gen_random_uuid(),
  area text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  constraint case_area_layouts_fields_array_check check (jsonb_typeof(fields) = 'array')
);

create index if not exists case_area_layouts_active_area_idx
  on public.case_area_layouts (is_active, area);

drop trigger if exists set_case_area_layouts_updated_at on public.case_area_layouts;
create trigger set_case_area_layouts_updated_at
before update on public.case_area_layouts
for each row execute function public.set_case_metadata_updated_at();

insert into public.case_area_layouts (area, name, description, fields)
values
  ('GENERAL', 'Formulario General', 'Campos operativos para casos del área General.', '[{"fieldKey":"subject","label":"Asunto","order":10,"required":true,"editable":true},{"fieldKey":"priority","label":"Prioridad","order":20,"required":true,"editable":true},{"fieldKey":"category","label":"Categoría","order":30,"required":false,"editable":true},{"fieldKey":"contact_type","label":"Tipo de contacto","order":40,"required":false,"editable":true}]'::jsonb),
  ('SOPORTE', 'Formulario Soporte', 'Campos operativos para casos de Soporte.', '[{"fieldKey":"subject","label":"Asunto","order":10,"required":true,"editable":true},{"fieldKey":"product","label":"Producto","order":20,"required":false,"editable":true},{"fieldKey":"subproduct","label":"Subproducto","order":30,"required":false,"editable":true},{"fieldKey":"priority","label":"Prioridad","order":40,"required":true,"editable":true},{"fieldKey":"category","label":"Categoría","order":50,"required":false,"editable":true}]'::jsonb),
  ('COMPLIANCE', 'Formulario Compliance', 'Campos operativos para casos de Compliance.', '[{"fieldKey":"subject","label":"Asunto","order":10,"required":true,"editable":true},{"fieldKey":"priority","label":"Prioridad","order":20,"required":true,"editable":true},{"fieldKey":"category","label":"Categoría","order":30,"required":true,"editable":true},{"fieldKey":"requiere_revision_manual","label":"Requiere revisión manual","order":40,"required":false,"editable":true}]'::jsonb)
on conflict (area) do nothing;

alter table public.case_area_layouts enable row level security;
grant select, insert, update on public.case_area_layouts to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'case_area_layouts'
      and policyname = 'case_area_layouts_demo_all'
  ) then
    create policy case_area_layouts_demo_all
      on public.case_area_layouts
      for all
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
