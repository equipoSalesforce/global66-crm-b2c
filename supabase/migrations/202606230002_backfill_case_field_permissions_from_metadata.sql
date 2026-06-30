insert into public.crm_case_field_permissions (role, field_key, can_view, can_edit)
select role_name, field_definitions.field_key, true, role_name = 'ADMIN'
from (
  values ('ADMIN'), ('SUPERVISOR'), ('AGENT')
) as roles(role_name)
cross join public.case_field_definitions field_definitions
where coalesce(field_definitions.is_active, true) = true
on conflict (role, field_key) do nothing;

notify pgrst, 'reload schema';
