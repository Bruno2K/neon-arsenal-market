#!/usr/bin/env bash
set -euo pipefail

api_container=${1:?API container name is required}
pg_container=${2:?PostgreSQL container name is required}
stop_file=${3:?Stop-file path is required}
output=${4:?Output path is required}

mkdir -p "$(dirname "$output")"
: > "$output"

while [[ ! -e "$stop_file" ]]; do
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  api_stats=$(docker stats --no-stream --format '{{json .}}' "$api_container" 2>/dev/null || echo '{}')
  pg_stats=$(docker stats --no-stream --format '{{json .}}' "$pg_container" 2>/dev/null || echo '{}')
  api_state=$(docker inspect --format '{"state":{{json .State}},"restartCount":{{.RestartCount}}}' "$api_container" 2>/dev/null || echo '{}')
  api_rss_kib=$(docker exec "$api_container" sh -c "awk '/^VmRSS:/ { print \$2 }' /proc/1/status" 2>/dev/null || true)
  pg_sample=$(docker exec "$pg_container" psql -X -A -t -U neon -d neon_arsenal_loadtest -c "
    SELECT json_build_object(
      'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()),
      'active', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'),
      'idle', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle'),
      'waiting', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type IS NOT NULL),
      'wait_events', COALESCE((
        SELECT json_agg(wait_sample ORDER BY wait_event_type, wait_event)
        FROM (
          SELECT wait_event_type, wait_event, count(*) AS connections
          FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type IS NOT NULL
          GROUP BY wait_event_type, wait_event
        ) wait_sample
      ), '[]'::json),
      'max_connections', current_setting('max_connections')::int,
      'deadlocks', deadlocks,
      'xact_commit', xact_commit,
      'xact_rollback', xact_rollback
    ) FROM pg_stat_database WHERE datname = current_database();
  " 2>/dev/null || echo '{}')

  jq -cn \
    --arg timestamp "$timestamp" \
    --argjson api "$api_stats" \
    --argjson postgres "$pg_stats" \
    --argjson apiState "$api_state" \
    --arg apiRssKiB "${api_rss_kib:-unavailable}" \
    --argjson postgresActivity "$pg_sample" \
    '{timestamp: $timestamp, api: $api, apiState: $apiState, apiRssKiB: $apiRssKiB, postgres: $postgres, postgresActivity: $postgresActivity}' \
    >> "$output"
  sleep 2
done
