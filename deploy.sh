#!/bin/sh
# One-command deploy for the VPS: pull latest, rebuild app + gateway-agent,
# restart. Deliberately does NOT run database migrations — if this push
# changed prisma/schema.prisma, it stops and tells you to review + run the
# migration by hand first (see the comment block below for why: an empty/
# wrong migration silently "succeeding" against a live database is a real
# failure mode that's already happened once on this project, and it's only
# caught by a human looking at the generated SQL before it's applied).
#
# Usage on the VPS:
#   cd ~/finestproxies && ./deploy.sh
#
# Called automatically by .github/workflows/deploy.yml on every push to
# master — that workflow calls this same script over SSH, so manual runs
# and CI runs always do exactly the same thing.
set -e
cd ~/finestproxies

echo "==> Fetching latest code..."
BEFORE_SCHEMA=$(git rev-parse HEAD:prisma/schema.prisma 2>/dev/null || echo "none")
git fetch origin master
git reset --hard origin/master
AFTER_SCHEMA=$(git rev-parse HEAD:prisma/schema.prisma 2>/dev/null || echo "none")

echo "==> Rebuilding app + gateway-agent images..."
docker compose -f docker-compose.prod.yml build app gateway-agent

if [ "$BEFORE_SCHEMA" != "$AFTER_SCHEMA" ]; then
  echo ""
  echo "!! prisma/schema.prisma changed in this deploy."
  echo "!! Images are built, but containers are NOT being restarted and NO migration has run."
  echo "!! Review + apply the migration by hand first:"
  echo "!!   docker compose -f docker-compose.prod.yml run --rm -v \"\$(pwd)/prisma/migrations:/app/prisma/migrations\" app npx prisma migrate dev --name <describe_the_change> --create-only"
  echo "!!   cat prisma/migrations/*<describe_the_change>*/migration.sql   # READ THIS before continuing"
  echo "!!   docker compose -f docker-compose.prod.yml run --rm -v \"\$(pwd)/prisma/migrations:/app/prisma/migrations\" app npx prisma migrate deploy"
  echo "!! Then re-run this script (or just: docker compose -f docker-compose.prod.yml up -d --force-recreate app gateway-agent) to restart the containers — --force-recreate matters, see the comment further down."
  exit 2
fi

echo "==> No schema change — restarting containers..."
# --force-recreate is required here, not optional: `up -d` alone only
# recreates a container when Compose detects its CONFIG changed (env vars,
# image tag, etc.) — a freshly rebuilt image under the same tag
# (finestproxies-app:latest) does not trigger that, so a plain `up -d`
# leaves the OLD container process running against the NEW image sitting
# unused on disk. This bit us for real: a schema migration was applied
# but `up -d` alone did not restart the app to pick up the code that
# expected the new tables, and it silently kept erroring in the
# background until a manual `restart` fixed it.
docker compose -f docker-compose.prod.yml up -d --force-recreate app gateway-agent

echo "==> Done. Recent logs:"
docker compose -f docker-compose.prod.yml logs app gateway-agent --tail 15
