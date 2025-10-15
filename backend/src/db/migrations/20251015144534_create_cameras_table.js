exports.up = function(knex) {
  return knex.schema.createTable('cameras', table => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('host').notNullable().unique();
    table.integer('port').defaultTo(80);
    table.string('user').notNullable();
    table.string('pass').notNullable(); // In a real application, this should be encrypted.
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('cameras');
};