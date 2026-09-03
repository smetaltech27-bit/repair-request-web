-- Local design only. Do not apply to a Supabase project without explicit approval.
insert into public.repair_departments (code, name)
values
  ('accounting', 'Accounting'),
  ('engineering', 'Engineering'),
  ('grinding-qc-delivery', 'Grinding/QC/Delivery'),
  ('hr', 'HR'),
  ('laser-punching-bending', 'Laser&Punching&Bending'),
  ('machine', 'Machine'),
  ('planning', 'Planning'),
  ('sheet-metal', 'Sheet Metal'),
  ('welding', 'Welding')
on conflict (code) do update
set name = excluded.name,
    is_active = true;

