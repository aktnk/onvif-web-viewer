exports.up = function(knex) {
  return knex.schema.table('cameras', function(table) {
    table.string('xaddr');
  });
};

exports.down = function(knex) {
  return knex.schema.table('cameras', function(table) {
    table.dropColumn('xaddr');
  });
};