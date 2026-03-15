const db = require('./db');

async function testSearch() {
    const pickupLocationId = 1; // Try location 1 (Bangkok usually)
    const pickupDate = '2026-03-03T10:00:00';
    const returnDate = '2026-03-05T10:00:00';

    try {
        const query = `
            SELECT c.*, ct.typeLabel as type_name, ct.service_rate as price_per_day
            FROM car c
            JOIN car_type ct ON c.type_id = ct.type_id
            WHERE c.car_status = 'Available'
              AND c.currentLocation_id = ?
              AND c.car_id NOT IN (
                  SELECT car_id FROM reservation
                  WHERE (pickupDate <= ? AND returnDate >= ?)
              )
        `;
        
        console.log("Executing Query...");
        const [cars] = await db.query(query, [pickupLocationId, returnDate, pickupDate]);
        console.log("Cars found:", cars.length);
        console.log(cars);
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

testSearch();