const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Admin@123',
    database: 'guardkey_db'
});

module.exports = db;
