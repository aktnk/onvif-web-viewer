/**
 * Migration: Add UVC_RTSP camera type support
 *
 * This migration adds 'uvc_rtsp' as a new camera type option.
 * UVC_RTSP cameras are USB cameras that are accessed via an intermediate RTSP server
 * (e.g., MediaMTX), allowing simultaneous streaming and recording without V4L2 device
 * exclusivity constraints.
 *
 * Camera types after this migration:
 * - 'onvif': Network IP cameras using ONVIF/RTSP protocol
 * - 'uvc': USB cameras accessed directly via V4L2 (Linux only, streaming OR recording)
 * - 'uvc_rtsp': USB cameras accessed via RTSP server (streaming AND recording)
 */

exports.up = function(knex) {
  // SQLite doesn't support ALTER TYPE directly, so we need to:
  // 1. Create a new column with the updated enum
  // 2. Copy data from old column
  // 3. Drop old column
  // 4. Rename new column

  return knex.schema.table('cameras', table => {
    // Add temporary column with new enum values
    table.enum('type_new', ['onvif', 'uvc', 'uvc_rtsp']).notNullable().defaultTo('onvif');
  })
  .then(() => {
    // Copy existing type values to new column
    return knex.raw('UPDATE cameras SET type_new = type');
  })
  .then(() => {
    return knex.schema.table('cameras', table => {
      // Drop old type column
      table.dropColumn('type');
    });
  })
  .then(() => {
    return knex.schema.table('cameras', table => {
      // Rename new column to 'type'
      table.renameColumn('type_new', 'type');
    });
  });
};

exports.down = function(knex) {
  // Revert to original enum values (onvif, uvc)
  // Note: This will fail if any cameras have type='uvc_rtsp'

  return knex.schema.table('cameras', table => {
    table.enum('type_new', ['onvif', 'uvc']).notNullable().defaultTo('onvif');
  })
  .then(() => {
    return knex.raw('UPDATE cameras SET type_new = type WHERE type IN (\'onvif\', \'uvc\')');
  })
  .then(() => {
    return knex.schema.table('cameras', table => {
      table.dropColumn('type');
    });
  })
  .then(() => {
    return knex.schema.table('cameras', table => {
      table.renameColumn('type_new', 'type');
    });
  });
};
