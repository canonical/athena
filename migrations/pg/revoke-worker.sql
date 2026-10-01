\if :{?WORKER_ROLE_NAME}
\else
  \echo 'WORKER_ROLE_NAME is required'
  \quit 1
\endif

SELECT true AS worker_role_exists
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'WORKER_ROLE_NAME')
\gset
\if :{?worker_role_exists}
\else
  \echo 'worker role no longer exists; privileges are already revoked'
  \quit 0
\endif

SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
  :'WORKER_ROLE_NAME'
)
\gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
  :'WORKER_ROLE_NAME'
)
\gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'WORKER_ROLE_NAME')
\gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'WORKER_ROLE_NAME')
\gexec
SELECT format('REVOKE USAGE ON SCHEMA public FROM %I', :'WORKER_ROLE_NAME')
\gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss REVOKE ALL ON TABLES FROM %I',
  :'WORKER_ROLE_NAME'
)
WHERE EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss')
\gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss REVOKE ALL ON SEQUENCES FROM %I',
  :'WORKER_ROLE_NAME'
)
WHERE EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss')
\gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA pgboss FROM %I', :'WORKER_ROLE_NAME')
WHERE EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss')
\gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA pgboss FROM %I', :'WORKER_ROLE_NAME')
WHERE EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss')
\gexec
SELECT format('REVOKE USAGE ON SCHEMA pgboss FROM %I', :'WORKER_ROLE_NAME')
WHERE EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss')
\gexec
