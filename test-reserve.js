const db = require('./db');

async function testReserve() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const customer = {
            TDL_ID: '1234567890123',
            firstname: 'John',
            lastname: 'Doe',
            phone: '1234567890',
            city: 'Bangkok',
            email: 'john@example.com'
        };

        console.log("1. Inserting customer...");
        const customerQuery = `
            INSERT INTO customer (TDL_ID, firstname, lastname, phone, city, email)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                firstname=VALUES(firstname), lastname=VALUES(lastname), 
                phone=VALUES(phone), city=VALUES(city), email=VALUES(email)
        `;
        const [custRes] = await connection.query(customerQuery, [
            customer.TDL_ID, customer.firstname, customer.lastname, 
            customer.phone, customer.city, customer.email
        ]);
        console.log("Customer inserted.");

        console.log("2. Inserting status...");
        const statusQuery = `
            INSERT INTO pickupreturn_status (status_description) 
            VALUES ('Pending')
        `;
        const [statusResult] = await connection.query(statusQuery);
        console.log("Status inserted.");

        await connection.rollback();
        process.exit(0);
    } catch (err) {
        await connection.rollback();
        console.error('Test Failed:', err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

testReserve();