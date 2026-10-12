DO $$
DECLARE
  current_role_is_superuser BOOLEAN;
  current_role_can_create_roles BOOLEAN;
BEGIN
  SELECT "rolsuper", "rolcreaterole"
  INTO current_role_is_superuser, current_role_can_create_roles
  FROM "pg_roles"
  WHERE "rolname" = CURRENT_USER;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athena_worker_runtime') THEN
    IF NOT current_role_is_superuser AND NOT current_role_can_create_roles THEN
      RAISE EXCEPTION
        'athena_worker_runtime does not exist and role % cannot create it', CURRENT_USER;
    END IF;

    CREATE ROLE athena_worker_runtime
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;

END
$$;

CREATE SCHEMA IF NOT EXISTS pgboss;

GRANT USAGE ON SCHEMA public TO athena_worker_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO athena_worker_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO athena_worker_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO athena_worker_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO athena_worker_runtime;

GRANT USAGE ON SCHEMA pgboss TO athena_worker_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO athena_worker_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO athena_worker_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO athena_worker_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
  GRANT USAGE, SELECT ON SEQUENCES TO athena_worker_runtime;
