require('dotenv').config();
const mysql = require('mysql2/promise');

// Database connection configuration using Environment Variables
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root', 
    database: process.env.DB_NAME || 'car_rental',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;