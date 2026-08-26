UPDATE "providerChat" pc
SET
  "defaultModel" = p."defaultModel",
  "enabledModels" = p."enabledModels"
FROM "provider" p
WHERE pc."provider" = p."id"
  AND p."updatedAt" > pc."updatedAt";

INSERT INTO "providerChat" ("provider", "defaultModel", "enabledModels")
SELECT p."id", p."defaultModel", p."enabledModels"
FROM "provider" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "providerChat" pc
  WHERE pc."provider" = p."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "providerEmbedder" pe
  WHERE pe."provider" = p."id"
)
ON CONFLICT ("provider") DO NOTHING;
