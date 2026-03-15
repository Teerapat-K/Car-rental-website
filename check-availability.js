const db = require('./db');

async function checkAvailability() {
    try {
        const [cars] = await db.query(`
            SELECT c.car_id, c.brand, c.model, o.city as location
            FROM car c
            LEFT JOIN crc_office o ON c.currentLocation_id = o.location_id
            WHERE c.car_status = 'Available'
        `);

        console.log('--- Available Cars ---');
        if (cars.length === 0) {
            console.log('No cars are currently marked as "Available" in the car table.');
        } else {
            cars.forEach(car => {
                console.log(`Car ID ${car.car_id}: ${car.brand} ${car.model} at ${car.location}`);
            });
        }

        console.log('\n--- Current Reservations (Booked Dates) ---');
        const [reservations] = await db.query(`
            SELECT r.car_id, c.brand, c.model, r.pickupDate, r.returnDate
            FROM reservation r
            JOIN car c ON r.car_id = c.car_id
            WHERE r.returnDate >= CURDATE()
            ORDER BY r.pickupDate ASC
        `);

        if (reservations.length === 0) {
            console.log('No upcoming reservations found. All available cars are free for any future date!');
        } else {
            reservations.forEach(res => {
                console.log(`Car ID ${res.car_id} (${res.brand} ${res.model}) is booked from: ${new Date(res.pickupDate).toLocaleString()} TO ${new Date(res.returnDate).toLocaleString()}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error('Error checking database:', err.message);
        process.exit(1);
    }
}

checkAvailability();