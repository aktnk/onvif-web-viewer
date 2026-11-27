exports.up = function(knex) {
  return knex.schema.table('cameras', function(table) {
    table.string('type');
  });
};

exports.down = function(knex) {
  return knex.schema.table('cameras', function(table) {
    table.dropColumn('type');
  });
};