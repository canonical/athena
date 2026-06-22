-- Trigger function to append an audit row to personaAudit on every persona INSERT, UPDATE, or DELETE.
-- The acting user is read from the session-local GUC app.current_actor, which callers must set
-- (via SELECT set_config('app.current_actor', $userId, true)) before executing the DML statement.
-- When the GUC is absent or empty (e.g. system-initiated seeds) the actor column is left NULL.
CREATE OR REPLACE FUNCTION personaAuditTriggerFn()
RETURNS TRIGGER AS $$
DECLARE
  actor_val TEXT;
  action_val TEXT;
  summary TEXT;
  before_val JSONB;
  after_val JSONB;
  persona_id UUID;
  loop_id UUID;
BEGIN
  actor_val := NULLIF(current_setting('app.current_actor', true), '');

  IF TG_OP = 'INSERT' THEN
    action_val := 'create';
    before_val := '{}'::jsonb;
    after_val  := jsonb_build_object(
      'displayName',        NEW."displayName",
      'personality',        NEW."personality",
      'usesCodingHarness',  NEW."usesCodingHarness",
      'isEngineeringManager', NEW."isEngineeringManager",
      'lifecycleStatus',    NEW."lifecycleStatus",
      'routingPriority',    NEW."routingPriority"
    );
    summary    := 'Created persona "' || NEW."displayName" || '".';
    persona_id := NEW."id";
    loop_id    := NEW."loop";

  ELSIF TG_OP = 'UPDATE' THEN
    action_val := 'update';
    before_val := jsonb_build_object(
      'displayName',        OLD."displayName",
      'personality',        OLD."personality",
      'usesCodingHarness',  OLD."usesCodingHarness",
      'isEngineeringManager', OLD."isEngineeringManager",
      'lifecycleStatus',    OLD."lifecycleStatus",
      'routingPriority',    OLD."routingPriority"
    );
    after_val  := jsonb_build_object(
      'displayName',        NEW."displayName",
      'personality',        NEW."personality",
      'usesCodingHarness',  NEW."usesCodingHarness",
      'isEngineeringManager', NEW."isEngineeringManager",
      'lifecycleStatus',    NEW."lifecycleStatus",
      'routingPriority',    NEW."routingPriority"
    );
    summary    := 'Updated persona "' || NEW."displayName" || '".';
    persona_id := NEW."id";
    loop_id    := NEW."loop";

  ELSIF TG_OP = 'DELETE' THEN
    action_val := 'delete';
    before_val := jsonb_build_object(
      'displayName',        OLD."displayName",
      'personality',        OLD."personality",
      'usesCodingHarness',  OLD."usesCodingHarness",
      'isEngineeringManager', OLD."isEngineeringManager",
      'lifecycleStatus',    OLD."lifecycleStatus",
      'routingPriority',    OLD."routingPriority"
    );
    after_val  := '{}'::jsonb;
    summary    := 'Deleted persona "' || OLD."displayName" || '".';
    persona_id := NULL;
    loop_id    := OLD."loop";
  END IF;

  INSERT INTO "personaAudit" ("persona", "loop", "actor", "action", "changeSummary", "snapshotBefore", "snapshotAfter")
  VALUES (persona_id, loop_id, actor_val, action_val, summary, before_val, after_val);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
