INSERT INTO public.social_subscriptions (user_id, workspace_id, status, activated_at, stripe_subscription_id)
VALUES 
  ('957cc69a-2bf0-4454-b417-1676987bbebd', '7575f085-11d4-4319-b6d5-b54ac619a0a7', 'active', now(), 'admin_bypass_7575'),
  ('957cc69a-2bf0-4454-b417-1676987bbebd', '65cc1937-ae4c-45a8-bb39-e395d44394c0', 'active', now(), 'admin_bypass_65cc'),
  ('957cc69a-2bf0-4454-b417-1676987bbebd', 'c5d7a58c-08ea-4c98-8cf8-9b2612e57cff', 'active', now(), 'admin_bypass_c5d7'),
  ('957cc69a-2bf0-4454-b417-1676987bbebd', '14ded17c-562f-408a-8872-e72ac671ec50', 'active', now(), 'admin_bypass_14de'),
  ('957cc69a-2bf0-4454-b417-1676987bbebd', '6d4619b4-b1d8-4ca8-8dc3-86b29c0bc12e', 'active', now(), 'admin_bypass_6d46'),
  ('957cc69a-2bf0-4454-b417-1676987bbebd', 'a52fb4c9-cb18-4074-8439-04fb378aad0c', 'active', now(), 'admin_bypass_a52f')
ON CONFLICT (user_id, workspace_id) DO UPDATE SET status = 'active', activated_at = now(), grace_started_at = null, grace_ends_at = null, cancelled_at = null, deleted_zernio_at = null;