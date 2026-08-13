# Athena quick start

This guide is the fastest way to get Athena running locally for evaluation.

## Prerequisites

- Docker with Compose support
- A free `:80` port on your machine

## Start Athena

1. Create a local environment file from the checked-in sample:

   ```bash
   cp .example.env .env
   ```

2. Start the local stack:

   ```bash
   docker compose up --build
   ```

3. Open Athena at [http://athena.localhost](http://athena.localhost).

4. Sign in through Dex with one of the seeded local users:

   - Email: `dev.user@canonical.com`
   - Password: `password`

## What starts

- Athena: [http://athena.localhost](http://athena.localhost)
- Dex: [http://dex.localhost/dex](http://dex.localhost/dex)
- PostgreSQL: `localhost:5432`

The Compose stack also runs the database migration step automatically before Athena starts.

## Use Athena loops

After sign-in, these are the minimum steps to make a loop usable.

1. Create a loop.
2. Open the new loop.
3. Confirm the loop has one active routing persona and at least one active execution persona. New loops receive default personas, so this is usually already satisfied.
4. Create a provider from the global provider area.
5. Configure that provider with a default model and at least one enabled model.
6. Assign the provider to your loop and make sure the assignment is active.
7. Create a runner from the global runner area.
8. Assign the runner to your loop and make sure the assignment is active.
9. Create a workgraph from the global workgraph area.
10. Assign the workgraph to your loop and make sure the assignment is active.
11. Configure the loop workgraph assignment with a JQL query.
12. Open the loop Tasks tab and verify the loop is no longer blocked.
13. Click New Task to create your first task.
14. Open the task, write your first message in the message box, and click Send.
15. If you want Athena to ingest work automatically from the workgraph, start synchronization for the assigned workgraph after the JQL query is configured.
16. After workgraph sync is enabled and started, Athena can create tasks automatically from synced workgraph items.