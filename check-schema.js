const db = require('./db');

async function showSchema() {
    try {
        const [officeCols] = await db.query("SHOW COLUMNS FROM crc_office");
        console.log("crc_office columns:", officeCols.map(c => c.Field));
        
        const [carCols] = await db.query("SHOW COLUMNS FROM car");
        console.log("car columns:", carCols.map(c => c.Field));

        const [resCols] = await db.query("SHOW COLUMNS FROM reservation");
        console.log("reservation columns:", resCols.map(c => c.Field));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

showSchema();