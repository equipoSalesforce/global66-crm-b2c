insert into public.crm_permissions (key, label, description, category)
values
  (
    'view_agents',
    'Ver agentes',
    'Permite ver agentes, disponibilidad, skills y carga operativa.',
    'agents'
  ),
  (
    'manage_agents',
    'Gestionar agentes',
    'Permite editar configuración operativa, disponibilidad y skills de agentes.',
    'agents'
  )
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  updated_at = now();

insert into public.crm_role_permissions (role, permission_key, enabled)
values
  ('ADMIN', 'view_agents', true),
  ('ADMIN', 'manage_agents', true),
  ('SUPERVISOR', 'view_agents', true)
on conflict (role, permission_key) do update
set enabled = excluded.enabled, updated_at = now();

insert into public.crm_role_permissions (role, permission_key, enabled)
values
  ('SUPERVISOR', 'manage_agents', false),
  ('AGENT', 'view_agents', false),
  ('AGENT', 'manage_agents', false)
on conflict (role, permission_key) do nothing;

notify pgrst, 'reload schema';
