-- PostgreSQL does not create indexes on referencing columns automatically.
-- Add a leading index for every foreign key that remains uncovered.

DO $$
DECLARE
  fk record;
  index_name text;
BEGIN
  FOR fk IN
    SELECT
      c.conrelid,
      c.conrelid::regclass AS table_name,
      c.conname,
      c.conkey,
      string_agg(quote_ident(a.attname), ', ' ORDER BY key_column.ordinality) AS columns_sql
    FROM pg_constraint c
    JOIN pg_class relation ON relation.oid = c.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = key_column.attnum
    WHERE c.contype = 'f'
      AND namespace.nspname = current_schema()
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indisvalid
          AND (
            SELECT array_agg(index_column.attnum ORDER BY index_column.ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS index_column(attnum, ordinality)
            WHERE index_column.ordinality <= cardinality(c.conkey)
          ) = c.conkey
      )
    GROUP BY c.conrelid, c.conname, c.conkey
  LOOP
    index_name :=
      left(replace(fk.table_name::text, '.', '_') || '_' || fk.conname, 54)
      || '_'
      || substr(md5(fk.conrelid::text || ':' || fk.conname), 1, 8);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (%s)',
      index_name,
      fk.table_name,
      fk.columns_sql
    );
  END LOOP;
END $$;
