#!/bin/bash
# ============================================================
# set_default_passwords.sh — Set password for all employees to 'abc123456'
# ============================================================
set -e

export KUBECONFIG="/home/terax/.kube/config"

# Bcrypt hash of 'abc123456'
PASSWORD_HASH='$2b$10$MAUamIWKu1qH4t.KSYLxxOv0jzJKXrvpA/2F2nCgHANIjnt4wcdsu'

echo "=========================================================="
echo " 🔒 SETTING DEFAULT PASSWORD 'abc123456' FOR ALL USERS"
echo "=========================================================="

MAIN_POD="terax-postgres-db-7c8c9dd9b5-r5fc6"

DBS=$(kubectl exec -i "$MAIN_POD" -- psql -U teraxadmin -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'teraxdb%' OR datname LIKE 'crc%';" | xargs)

for db in $DBS; do
  echo "   -> Updating passwords in database: $db"
  kubectl exec -i "$MAIN_POD" -- psql -U teraxadmin -d "$db" -c "UPDATE employee SET password = '$PASSWORD_HASH';" || true
done

echo ""
echo "=========================================================="
echo " 🎉 DEFAULT PASSWORD SET SUCCESSFULLY FOR ALL DATABASES!"
echo "=========================================================="
