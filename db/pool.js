const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'my_shop',
    password: 'purplesoda1',
    port: 5432
});

module.exports = pool