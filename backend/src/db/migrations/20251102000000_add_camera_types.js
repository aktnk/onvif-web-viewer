/**
 * Migration: Add camera type support (ONVIF and UVC)
 *
 * This migration:
 * 1. Adds 'type' column to differentiate between ONVIF and UVC cameras
 * 2. Adds 'device_path' column for UVC cameras (/dev/video0, etc.)
 * 3. Makes ONVIF-specific columns nullable (host, port, user, pass)
 * 4. Sets all existing cameras to 'onvif' type
 */

exports.up = function(knex) {
  return knex.schema.table('cameras', table => {
    // Add camera type column (onvif or uvc)
    table.enum('type', ['onvif', 'uvc']).notNullable().defaultTo('onvif');

    // Add device path for UVC cameras
    table.string('device_path').nullable();

    // Make ONVIF-specific fields nullable
    // This requires recreating the constraints
    table.string('host').nullable().alter();
    table.integer('port').nullable().alter();
    table.string('user').nullable().alter();
    table.string('pass').nullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.table('cameras', table => {
    // Remove new columns
    table.dropColumn('type');
    table.dropColumn('device_path');

    // Revert ONVIF fields to NOT NULL
    table.string('host').notNullable().alter();
    table.integer('port').notNullable().alter();
    table.string('user').notNullable().alter();
    table.string('pass').notNullable().alter();
  });
};
