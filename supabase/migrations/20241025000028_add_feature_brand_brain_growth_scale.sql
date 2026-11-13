INSERT INTO plan_entitlements (plan_id, key, value_type, bool_value)
VALUES
  ('7c7c8afb-4dcf-4b06-a1c0-36179c759af3', 'feature_brand_brain', 'BOOLEAN', true),
  ('332a8a27-af19-4312-ba68-b69137160352', 'feature_brand_brain', 'BOOLEAN', true)
ON CONFLICT (plan_id, key) DO UPDATE
  SET value_type = EXCLUDED.value_type,
      bool_value = EXCLUDED.bool_value;
