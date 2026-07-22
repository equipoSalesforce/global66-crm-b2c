-- Agrega un esquema estructurado y backward compatible para el Tab Form.

alter table public.case_area_layouts
  add column if not exists layout_schema jsonb;

update public.case_area_layouts
set layout_schema = jsonb_build_object(
  'version', 2,
  'sections', jsonb_build_array(
    jsonb_build_object(
      'id', 'legacy-' || lower(regexp_replace(area, '[^a-zA-Z0-9]+', '-', 'g')),
      'name', name,
      'description', description,
      'order', 10,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', 'field-' || coalesce(field_item ->> 'fieldKey', row_number::text),
            'type', 'FIELD',
            'sourceType', 'CASE',
            'fieldKey', field_item ->> 'fieldKey',
            'label', field_item ->> 'label',
            'order', coalesce((field_item ->> 'order')::integer, row_number * 10),
            'required', coalesce((field_item ->> 'required')::boolean, false),
            'editable', coalesce((field_item ->> 'editable')::boolean, true),
            'columnSpan', 1
          ) order by coalesce((field_item ->> 'order')::integer, row_number * 10)
        )
        from jsonb_array_elements(fields) with ordinality as legacy_fields(field_item, row_number)
      ), '[]'::jsonb)
    )
  )
)
where layout_schema is null;

alter table public.case_area_layouts
  drop constraint if exists case_area_layouts_schema_object_check;
alter table public.case_area_layouts
  add constraint case_area_layouts_schema_object_check
  check (layout_schema is null or jsonb_typeof(layout_schema) = 'object');

comment on column public.case_area_layouts.layout_schema is
  'Esquema v2 del Tab Form. Contiene secciones ordenadas con items FIELD o SPACER. fields se conserva como proyección legacy.';

notify pgrst, 'reload schema';
