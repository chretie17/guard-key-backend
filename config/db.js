const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Msx246ru!',
    database: 'guardkey_db'
});

module.exports = db;
