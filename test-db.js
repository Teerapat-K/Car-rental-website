const db = require('./db');

async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ Successfully connected to the car_rental database!');
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Database connection failed:');
        console.error(err.message);
        process.exit(1);
    }
}

testConnection();