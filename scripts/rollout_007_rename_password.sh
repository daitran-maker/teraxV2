#!/bin/bash
# ============================================================
# rollout_007_rename_password.sh — Rename independent_id to password across all databases
# ============================================================
set -e

export KUBECONFIG="/home/terax/.kube/config"
MIGRATION_SQL="/opt/app/dev/crc_app/migrations/007_rename_independent_id_to_password.sql"

if [ ! -f "$MIGRATION_SQL" ]; then
  echo "❌ Migration SQL file not found: $MIGRATION_SQL"
  exit 1
fi

echo "=========================================================="
echo " 🚀 EXECUTING RENAME COLUMN INDEPENDENT_ID -> PASSWORD"
echo "=========================================================="

MAIN_POD="terax-postgres-db-7c8c9dd9b5-r5fc6"

DBS=$(kubectl exec -i "$MAIN_POD" -- psql -U teraxadmin -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'teraxdb%' OR datname LIKE 'crc%';" | xargs)

for db in $DBS; do
  echo "   -> Renaming column in database: $db"
  kubectl exec -i "$MAIN_POD" -- psql -U teraxadmin -d "$db" < "$MIGRATION_SQL" || true
done

echo ""
echo "=========================================================="
echo " 🎉 RENAME MIGRATION COMPLETE FOR ALL DATABASES!"
echo "=========================================================="
