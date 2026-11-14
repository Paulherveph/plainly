-- Pricing v2 (docs/PRICING.md section 2): the public page shows Free, Pro and Max.
-- Guest stays as the no-account trial but is not sold as a plan.
-- Yearly plans give two months free (10 x monthly), shown as "Save 17%".

update public.plans set price_cents = 12000 where id = 'pro_year';

update public.plans set active = true, name = 'Max' where id = 'max_month';

insert into public.plans (id, name, kind, price_cents, interval, sort, active, entitlements) values
  ('max_year', 'Max (yearly)', 'subscription', 39000, 'year', 5, true,
   '{"credits":1500,"maxPages":100,"maxBytes":31457280,"retentionDays":365,"deepChat":true,"allLocales":true,"concurrency":5,"packs":true}')
on conflict (id) do nothing;
