-- Creates an updatedAt trigger for the given table only when absent
CREATE OR REPLACE FUNCTION ensureUpdatedAtTrigger(table_name text)
RETURNS void
AS $$
DECLARE
  trigger_name text := table_name || 'UpdatedAtTrigger';
  trigger_exists boolean := false;
  schema_name text := current_schema;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND c.relname = table_name
      AND t.tgname = trigger_name
      AND n.nspname = schema_name
  ) INTO trigger_exists;

  IF NOT trigger_exists THEN
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION updatedAtAutomation()',
      trigger_name,
      schema_name,
      table_name
    );
  END IF;
END;
$$
LANGUAGE plpgsql;