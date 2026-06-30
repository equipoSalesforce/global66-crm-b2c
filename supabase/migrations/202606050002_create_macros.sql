create table if not exists public.macros (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  target_object text not null default 'CASE',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.macro_actions (
  id uuid primary key default gen_random_uuid(),
  macro_id uuid references public.macros(id) on delete cascade,
  action_type text not null,
  sort_order int default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.macro_runs (
  id uuid primary key default gen_random_uuid(),
  macro_id uuid references public.macros(id),
  target_object text,
  target_id uuid,
  executed_by text,
  status text,
  result jsonb,
  created_at timestamptz default now()
);

create index if not exists macros_target_active_idx
  on public.macros(target_object, is_active);

create index if not exists macro_actions_macro_sort_idx
  on public.macro_actions(macro_id, sort_order);

create index if not exists macro_runs_target_idx
  on public.macro_runs(target_object, target_id, created_at desc);

with demo_macros(name, description, actions) as (
  values
    (
      'Escalar transferencia no recibida',
      'Clasifica y escala un caso de transferencia internacional no recibida.',
      '[
        {"action_type":"UPDATE_CASE_FIELDS","payload":{"priority":"HIGH","area":"SOPORTE","category":"RECLAMO","routing_status":"HUMAN_REQUIRED","status":"HUMAN_REQUIRED","lifecycle_status":"IN_PROGRESS"}},
        {"action_type":"ADD_INTERNAL_NOTE","payload":{"note":"Caso escalado por macro: transferencia no recibida."}}
      ]'::jsonb
    ),
    (
      'Marcar posible fraude',
      'Marca el caso como alerta operacional de posible fraude.',
      '[
        {"action_type":"UPDATE_CASE_FIELDS","payload":{"priority":"HIGH","area":"FRAUDE","category":"ALERTA","routing_status":"HUMAN_REQUIRED","status":"HUMAN_REQUIRED"}},
        {"action_type":"ADD_INTERNAL_NOTE","payload":{"note":"Caso marcado como posible fraude por macro."}}
      ]'::jsonb
    ),
    (
      'Cierre con respuesta estándar',
      'Registra una respuesta estándar y cierra el caso.',
      '[
        {"action_type":"SEND_REPLY","payload":{"channel":"INTERNAL","body":"Gracias por contactarnos. Dejamos el caso resuelto."}},
        {"action_type":"CLOSE_CASE","payload":{}}
      ]'::jsonb
    ),
    (
      'Solicitar antecedentes',
      'Solicita más antecedentes por el canal disponible y deja el caso en progreso.',
      '[
        {"action_type":"SEND_REPLY","payload":{"channel":"AUTO","body":"Para ayudarte necesitamos que nos compartas más antecedentes de la operación.","subject":"Solicitud de antecedentes"}},
        {"action_type":"UPDATE_CASE_FIELDS","payload":{"lifecycle_status":"IN_PROGRESS"}}
      ]'::jsonb
    )
),
inserted_macros as (
  insert into public.macros(name, description, target_object, is_active)
  select name, description, 'CASE', true
  from demo_macros
  where not exists (
    select 1 from public.macros existing where existing.name = demo_macros.name
  )
  returning id, name
)
insert into public.macro_actions(macro_id, action_type, sort_order, payload)
select inserted_macros.id,
  action_item.value->>'action_type',
  action_item.ordinality::int - 1,
  action_item.value->'payload'
from inserted_macros
join demo_macros on demo_macros.name = inserted_macros.name
cross join lateral jsonb_array_elements(demo_macros.actions) with ordinality as action_item(value, ordinality);
