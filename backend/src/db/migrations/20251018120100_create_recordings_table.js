/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('recordings', (table) => {
    table.increments('id').primary();
    table.integer('camera_id').unsigned().notNullable();
    table.foreign('camera_id').references('id').inTable('cameras').onDelete('CASCADE');
    table.string('filename').notNullable();
    table.timestamp('start_time').defaultTo(knex.fn.now());
    table.timestamp('end_time');
    table.boolean('is_finished').defaultTo(false);
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('recordings');
};