#!/usr/bin/env bash
# Rebuilds a throwaway database from migrations 001..N and runs the database
# security suite against it.
#   ADMIN_DATABASE_URL  connection to an existing database used to (re)create the test DB
#                       (default postgresql://postgres:postgres@127.0.0.1:5432/postgres)
#   TEST_DB_NAME        name of the throwaway database (default nirikshak_test)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
admin_url="${ADMIN_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/postgres}"
db="${TEST_DB_NAME:-nirikshak_test}"
psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$db\"" -c "CREATE DATABASE \"$db\""
test_url="${admin_url%/*}/$db"
DATABASE_URL="$test_url" "$here/apply-migrations.sh" > /dev/null
psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$here/10_rls_security_tests.sql" 2>&1 | sed -n 's/.*NOTICE:  ok /ok /p; /FAIL/p; /ERROR/p; /PASSED/p'
status=${PIPESTATUS[0]}
exit "$status"
