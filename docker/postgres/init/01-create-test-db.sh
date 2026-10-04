#!/bin/sh
# Runs only on the first start of an empty data volume.
# Creates the database used by backend e2e tests.
set -e

if [ -n "$POSTGRES_TEST_DB" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE "$POSTGRES_TEST_DB" OWNER "$POSTGRES_USER";
EOSQL
fi
