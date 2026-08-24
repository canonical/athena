-- Permit the deterministic test provider's HTTP endpoint.
ALTER TABLE "provider" DROP CONSTRAINT IF EXISTS "provider_baseUrl_check";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"provider"'::regclass AND conname = 'providerBaseUrlScheme'
  ) THEN
    ALTER TABLE "provider"
      ADD CONSTRAINT "providerBaseUrlScheme" CHECK ("baseUrl" ~* '^https?://');
  END IF;
END
$$;
