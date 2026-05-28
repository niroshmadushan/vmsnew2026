const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkData() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        console.log('Connected to database');

        const [rows] = await connection.execute(
            `SELECT id, title, booking_date, total_participants, refreshments_required, 
              (SELECT COUNT(*) FROM booking_participants WHERE booking_id = bookings.id) as internal_count,
              (SELECT COUNT(*) FROM external_participants WHERE booking_id = bookings.id) as external_count
       FROM bookings 
       WHERE booking_date = CURDATE() OR booking_date = CURDATE() + INTERVAL 1 DAY
       LIMIT 5`
        );

        console.log('Booking Data Check:');
        rows.forEach(row => {
            console.log('------------------------------------------------');
            console.log(`ID: ${row.id}`);
            console.log(`Title: ${row.title}`);
            console.log(`Date: ${row.booking_date}`);
            console.log(`Total Participants (Column): ${row.total_participants}`);
            console.log(`Actual Part. Count (Calculated): ${row.internal_count + row.external_count}`);
            console.log(`Refreshments Required: ${row.refreshments_required}`);
            console.log(`Data Consistent: ${row.total_participants == (row.internal_count + row.external_count)}`);
        });

        if (rows.length === 0) {
            console.log("No bookings found for today or tomorrow.");
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkData();
