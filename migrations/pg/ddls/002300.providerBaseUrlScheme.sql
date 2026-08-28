-- Accept HTTP and HTTPS provider endpoints.
-- "provider_baseUrl_check" is the name Postgres generated for the inline CHECK in 000900.provider.sql.
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
