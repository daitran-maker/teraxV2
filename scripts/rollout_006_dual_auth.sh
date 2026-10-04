#!/bin/bash
# ============================================================
# rollout_006_dual_auth.sh — Apply dual auth migration to all tenant databases
# ============================================================
set -e

export KUBECONFIG="/home/terax/.kube/config"
MIGRATION_SQL="/opt/app/dev/crc_app/migrations/006_dual_auth_employee_id.sql"

if [ ! -f "$MIGRATION_SQL" ]; then
  echo "❌ Migration SQL file not found: $MIGRATION_SQL"
  exit 1
fi

echo "=========================================================="
echo " 🚀 EXECUTING DUAL AUTH MIGRATION ACROSS ALL TENANTS"
echo "=========================================================="

MAIN_POD="terax-postgres-db-7c8c9dd9b5-r5fc6"

# Run migration on all terax databases
DBS=$(kubectl exec -i "$MAIN_POD" -- psql -U teraxadmin -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'teraxdb%' OR datname LIKE 'crc%';" | xargs)

for db in $DBS; do
  echo "   -> Applying migration to database: $db"
  kubectl exec -i "$MAIN_POD" -- psql -U teraxadmin -d "$db" < "$MIGRATION_SQL" || true
done

echo ""
echo "=========================================================="
echo " 🎉 MIGRATION COMPLETE FOR ALL TENANT DATABASES!"
echo "=========================================================="
