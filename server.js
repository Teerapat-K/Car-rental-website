const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// API ROUTES
// ==========================================

// GET /locations - Populate search dropdowns
app.get('/api/locations', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM crc_office');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching locations:', err);
        res.status(500).json({ error: 'Failed to retrieve locations' });
    }
});

// POST /search - Find available cars based on location and date
app.post('/api/search', async (req, res) => {
    const { pickupLocationId, pickupDate, returnDate } = req.body;

    try {
        // Find cars at the pickup location that are "Available"
        // Cross-reference with reservation to ensure no date overlaps
        // Assuming columns: reservation.pickup_date, reservation.return_date
        const query = `
            SELECT c.*, ct.typeLabel as type_name, ct.service_rate as price_per_day
            FROM car c
            JOIN car_type ct ON c.type_id = ct.type_id
            WHERE c.car_status != 'not ready'
              AND c.currentLocation_id = ?
              AND c.car_id NOT IN (
                  SELECT car_id FROM reservation
                  WHERE (pickupDate < ? AND returnDate > ?)
              )
        `;
        
        const [cars] = await db.query(query, [pickupLocationId, returnDate, pickupDate]);

        if (cars.length === 0) {
            return res.status(200).json({ 
                message: "Sorry, there's no car available at your location and time.", 
                cars: [] 
            });
        }

        res.status(200).json({ cars });
    } catch (err) {
        console.error('Error searching cars:', err);
        res.status(500).json({ error: 'Search failed due to a server error: ' + err.message });
    }
});

// POST /api/reserve - Handle the final transaction
app.post('/api/reserve', async (req, res) => {
    const { 
        carId, pickupLocationId, returnLocationId, 
        pickupDate, returnDate, customer 
    } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Insert/Update Customer
        const [[existingCustomer]] = await connection.query('SELECT customer_id FROM customer WHERE TDL_ID = ?', [customer.TDL_ID]);
        let finalCustId;

        if (existingCustomer) {
            finalCustId = existingCustomer.customer_id;
            await connection.query(`
                UPDATE customer SET firstname=?, lastname=?, phone=?, city=?, email=? WHERE customer_id=?
            `, [customer.firstname, customer.lastname, parseInt(customer.phone.replace(/\\D/g, '') || 0, 10), customer.city, customer.email, finalCustId]);
        } else {
            const [[{ maxCustId }]] = await connection.query('SELECT MAX(customer_id) as maxCustId FROM customer');
            finalCustId = (maxCustId || 0) + 1;
            await connection.query(`
                INSERT INTO customer (customer_id, TDL_ID, firstname, lastname, phone, city, email)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [finalCustId, parseInt(customer.TDL_ID.replace(/\\D/g, '') || 0, 10), customer.firstname, customer.lastname, parseInt(customer.phone.replace(/\\D/g, '') || 0, 10), customer.city, customer.email]);
        }

        // 2. Create pickupreturn_status record
        const [[{ maxStatusId }]] = await connection.query('SELECT MAX(status_id) as maxStatusId FROM pickupreturn_status');
        const nextStatusId = (maxStatusId || 0) + 1;

        await connection.query(`
            INSERT INTO pickupreturn_status (status_id, pickupLocation_id, ReturnLocation_id, pickupDate, returnDate, car_condition) 
            VALUES (?, ?, ?, ?, ?, 'Pending Pickup')
        `, [nextStatusId, pickupLocationId, returnLocationId, pickupDate, returnDate]);

        // 3. Get rate and calculate amount
        const [[carData]] = await connection.query('SELECT ct.service_rate FROM car c JOIN car_type ct ON c.type_id = ct.type_id WHERE c.car_id = ?', [carId]);
        const rate = carData ? carData.service_rate : 1000;
        const days = Math.ceil((new Date(returnDate) - new Date(pickupDate)) / (1000 * 60 * 60 * 24)) || 1;
        const amount = rate * days;

        // 4. Insert Reservation
        const [[{ maxResId }]] = await connection.query('SELECT MAX(reservation_id) as maxResId FROM reservation');
        const nextResId = (maxResId || 0) + 1;

        await connection.query(`
            INSERT INTO reservation (
                reservation_id, car_id, customer_id, amount, booking_date, 
                pickupDate, returnDate, payment_check, status_id
            ) VALUES (?, ?, ?, ?, NOW(), ?, ?, 1, ?)
        `, [nextResId, carId, finalCustId, amount, pickupDate, returnDate, nextStatusId]);

        // Commit transaction
        await connection.commit();
        res.status(200).json({ message: 'payment successfully' });

    } catch (err) {
        await connection.rollback();
        console.error('Transaction Failed:', err);
        res.status(500).json({ error: 'Reservation failed: ' + err.message });
    } finally {
        connection.release();
    }
});

// GET /api/dashboard - Get available vehicle counts grouped by parking location
app.get('/api/dashboard', async (req, res) => {
    try {
        const query = `
            SELECT o.city, o.address, o.location_id, COUNT(c.car_id) as available_count
            FROM crc_office o
            LEFT JOIN car c ON o.location_id = c.currentLocation_id AND c.car_status = 'Available'
            GROUP BY o.location_id, o.city, o.address
            ORDER BY available_count DESC
        `;        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).json({ error: 'Failed to retrieve dashboard data' });
    }
});

// GET /api/profile/:tdl - Get customer profile and booking history
app.get('/api/profile/:tdl', async (req, res) => {
    try {
        const tdlId = parseInt(req.params.tdl.replace(/\\D/g, '') || 0, 10);
        
        // 1. Get customer info
        const [[customer]] = await db.query('SELECT * FROM customer WHERE TDL_ID = ?', [tdlId]);
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // 2. Get booking history
        const historyQuery = `
            SELECT r.reservation_id, r.booking_date, r.pickupDate, r.returnDate, r.amount, 
                   c.brand, c.model, s.car_condition
            FROM reservation r
            JOIN car c ON r.car_id = c.car_id
            JOIN pickupreturn_status s ON r.status_id = s.status_id
            WHERE r.customer_id = ?
            ORDER BY r.pickupDate DESC
        `;
        const [history] = await db.query(historyQuery, [customer.customer_id]);

        res.json({ customer, history });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ error: 'Failed to retrieve profile data' });
    }
});

// GET /api/categories - Fetch car categories for catalog
app.get('/api/categories', async (req, res) => {
    try {
        const query = 'SELECT typeLabel, typeDescr, service_rate FROM car_type';
        const [categories] = await db.query(query);
        res.json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Failed to retrieve categories' });
    }
});

// POST /api/admin/login - Authenticate Admin
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'Adminploy@gmail.com' && password === 'skibidi007xd') {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// GET /api/admin/pending-pickups - Admin Dashboard: List of cars pending pickup
app.get('/api/admin/pending-pickups', async (req, res) => {
    try {
        const query = `
            SELECT c.car_id, c.brand, c.model, c.car_status, 
                   r.reservation_id, r.pickupDate, r.returnDate, r.status_id,
                   s.car_condition
            FROM car c
            JOIN reservation r ON c.car_id = r.car_id
            JOIN pickupreturn_status s ON r.status_id = s.status_id
            WHERE s.car_condition = 'Pending Pickup'
            ORDER BY r.pickupDate ASC
        `;
        const [cars] = await db.query(query);
        res.json(cars);
    } catch (err) {
        console.error('Error fetching pending pickups:', err);
        res.status(500).json({ error: 'Failed to retrieve pending pickups' });
    }
});

// POST /api/admin/pickup - Admin Confirm Pickup
app.post('/api/admin/pickup', async (req, res) => {
    const { car_id, status_id } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Update pickupreturn_status to 'Rented'
        await connection.query(
            "UPDATE pickupreturn_status SET car_condition = 'Rented' WHERE status_id = ?",
            [status_id]
        );

        // 2. Update car status to 'rented'
        await connection.query(
            "UPDATE car SET car_status = 'rented' WHERE car_id = ?",
            [car_id]
        );

        await connection.commit();
        res.json({ success: true, message: 'Pickup confirmed. Car status set to rented.' });
    } catch (err) {
        await connection.rollback();
        console.error('Error confirming pickup:', err);
        res.status(500).json({ error: 'Failed to confirm pickup: ' + err.message });
    } finally {
        connection.release();
    }
});

// GET /api/admin/rented-cars - Admin Dashboard: List of rented cars
app.get('/api/admin/rented-cars', async (req, res) => {
    try {
        const query = `
            SELECT c.car_id, c.brand, c.model, c.car_status, 
                   r.reservation_id, r.pickupDate, r.returnDate, r.status_id,
                   s.car_condition
            FROM car c
            JOIN reservation r ON c.car_id = r.car_id
            JOIN pickupreturn_status s ON r.status_id = s.status_id
            WHERE s.car_condition = 'Rented'
            ORDER BY r.returnDate ASC
        `;
        const [cars] = await db.query(query);
        res.json(cars);
    } catch (err) {
        console.error('Error fetching rented cars:', err);
        res.status(500).json({ error: 'Failed to retrieve rented cars' });
    }
});

// POST /api/admin/return - Admin Return logic and state machine updates
app.post('/api/admin/return', async (req, res) => {
    const { car_id, status_id, car_condition } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Update pickupreturn_status
        await connection.query(
            'UPDATE pickupreturn_status SET car_condition = ? WHERE status_id = ?',
            [car_condition, status_id]
        );

        // 2. Determine new car_status based on condition (State Machine Return Phase)
        const newStatus = (car_condition && car_condition.toLowerCase() === 'clean') ? 'available' : 'not ready';

        // 3. Update car status
        await connection.query(
            'UPDATE car SET car_status = ? WHERE car_id = ?',
            [newStatus, car_id]
        );

        await connection.commit();
        res.json({ success: true, message: `Car returned successfully. Status set to ${newStatus}.` });
    } catch (err) {
        await connection.rollback();
        console.error('Error processing return:', err);
        res.status(500).json({ error: 'Failed to process return: ' + err.message });
    } finally {
        connection.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (or http://localhost:${PORT})`);
});
