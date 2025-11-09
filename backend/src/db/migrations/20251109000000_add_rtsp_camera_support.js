/**
 * Migration to add RTSP camera support
 * - Changes camera type from ('onvif', 'uvc', 'uvc_rtsp') to ('onvif', 'rtsp')
 * - Adds stream_path column for RTSP cameras
 * - Migrates existing uvc_rtsp cameras to rtsp type
 * - Removes device_path column (no longer needed)
 */

exports.up = async function(knex) {
  // Step 1: Create new table with updated schema
  await knex.schema.raw(`
    CREATE TABLE cameras_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      host TEXT,
      port INTEGER,
      user TEXT,
      pass TEXT,
      xaddr TEXT,
      stream_path TEXT,
      type TEXT NOT NULL CHECK (type IN ('onvif', 'rtsp')) DEFAULT 'onvif',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Step 2: Copy data from old table, converting uvc_rtsp to rtsp
  await knex.schema.raw(`
    INSERT INTO cameras_new (id, name, host, port, user, pass, xaddr, stream_path, type, created_at, updated_at)
    SELECT
      id, name, host, port, user, pass, xaddr, NULL,
      CASE WHEN type = 'uvc_rtsp' THEN 'rtsp' ELSE type END,
      created_at, updated_at
    FROM cameras
    WHERE type IN ('onvif', 'uvc_rtsp')
  `);

  // Step 3: Drop old table and rename new table
  await knex.schema.dropTable('cameras');
  await knex.schema.raw('ALTER TABLE cameras_new RENAME TO cameras');

  // Step 4: Recreate index
  await knex.schema.raw('CREATE UNIQUE INDEX cameras_host_unique ON cameras (host)');
};

exports.down = async function(knex) {
  // Reverse migration: change rtsp back to uvc_rtsp and restore device_path column
  await knex.schema.raw(`
    CREATE TABLE cameras_old (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      host TEXT,
      port INTEGER,
      user TEXT,
      pass TEXT,
      xaddr TEXT,
      device_path TEXT,
      type TEXT NOT NULL CHECK (type IN ('onvif', 'uvc', 'uvc_rtsp')) DEFAULT 'onvif',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Copy data back, converting rtsp to uvc_rtsp
  await knex.schema.raw(`
    INSERT INTO cameras_old (id, name, host, port, user, pass, xaddr, device_path, type, created_at, updated_at)
    SELECT
      id, name, host, port, user, pass, xaddr, NULL,
      CASE WHEN type = 'rtsp' THEN 'uvc_rtsp' ELSE type END,
      created_at, updated_at
    FROM cameras
  `);

  await knex.schema.dropTable('cameras');
  await knex.schema.raw('ALTER TABLE cameras_old RENAME TO cameras');
  await knex.schema.raw('CREATE UNIQUE INDEX cameras_host_unique ON cameras (host)');
};
