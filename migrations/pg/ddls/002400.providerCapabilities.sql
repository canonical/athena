ALTER TABLE "provider"
  ADD COLUMN IF NOT EXISTS "defaultModel" TEXT,
  ADD COLUMN IF NOT EXISTS "enabledModels" TEXT[],
  ADD COLUMN IF NOT EXISTS "chatDefaultModel" TEXT,
  ADD COLUMN IF NOT EXISTS "chatEnabledModels" TEXT[],
  ADD COLUMN IF NOT EXISTS "embeddingDefaultModel" TEXT,
  ADD COLUMN IF NOT EXISTS "embeddingEnabledModels" TEXT[];

UPDATE "provider"
SET
  "chatDefaultModel" = COALESCE("chatDefaultModel", "defaultModel"),
  "defaultModel" = COALESCE("chatDefaultModel", "defaultModel"),
  "chatEnabledModels" = COALESCE("chatEnabledModels", "enabledModels"),
  "enabledModels" = COALESCE("chatEnabledModels", "enabledModels");

CREATE OR REPLACE FUNCTION syncProviderModelCapabilitiesCompatibility()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."chatDefaultModel" = COALESCE(NEW."chatDefaultModel", NEW."defaultModel");
    NEW."defaultModel" = COALESCE(NEW."defaultModel", NEW."chatDefaultModel");
    NEW."chatEnabledModels" = COALESCE(NEW."chatEnabledModels", NEW."enabledModels");
    NEW."enabledModels" = COALESCE(NEW."enabledModels", NEW."chatEnabledModels");
    RETURN NEW;
  END IF;

  IF NEW."chatDefaultModel" IS DISTINCT FROM OLD."chatDefaultModel"
    AND NEW."defaultModel" IS NOT DISTINCT FROM OLD."defaultModel" THEN
    NEW."defaultModel" = NEW."chatDefaultModel";
  ELSIF NEW."defaultModel" IS DISTINCT FROM OLD."defaultModel"
    AND NEW."chatDefaultModel" IS NOT DISTINCT FROM OLD."chatDefaultModel" THEN
    NEW."chatDefaultModel" = NEW."defaultModel";
  ELSIF NEW."chatDefaultModel" IS DISTINCT FROM NEW."defaultModel" THEN
    RAISE EXCEPTION 'Conflicting chat default model values from mixed provider schema versions.';
  END IF;

  IF NEW."chatEnabledModels" IS DISTINCT FROM OLD."chatEnabledModels"
    AND NEW."enabledModels" IS NOT DISTINCT FROM OLD."enabledModels" THEN
    NEW."enabledModels" = NEW."chatEnabledModels";
  ELSIF NEW."enabledModels" IS DISTINCT FROM OLD."enabledModels"
    AND NEW."chatEnabledModels" IS NOT DISTINCT FROM OLD."chatEnabledModels" THEN
    NEW."chatEnabledModels" = NEW."enabledModels";
  ELSIF NEW."chatEnabledModels" IS DISTINCT FROM NEW."enabledModels" THEN
    RAISE EXCEPTION 'Conflicting chat enabled model values from mixed provider schema versions.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "providerModelCapabilitiesCompatibilityTrigger" ON "provider";
CREATE TRIGGER "providerModelCapabilitiesCompatibilityTrigger"
  BEFORE INSERT OR UPDATE ON "provider"
  FOR EACH ROW
  EXECUTE FUNCTION syncProviderModelCapabilitiesCompatibility();