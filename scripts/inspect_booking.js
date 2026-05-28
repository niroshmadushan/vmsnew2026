const mysql = require('mysql2/promise');

async function inspectBooking() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'auth-db2',
      port: 3306
    });

    console.log('Successfully connected to database "auth-db2".');

    // 1. Query for the specific booking ID
    const [bookingRows] = await conn.execute(
      'SELECT * FROM bookings WHERE id = ?',
      ['e50b14a6-29d3-4371-aa0f-902e3076554a']
    );

    console.log('\n--- TARGET BOOKING ---');
    if (bookingRows.length > 0) {
      console.log('Booking found in database:');
      console.log(JSON.stringify(bookingRows[0], null, 2));
    } else {
      console.log('Target booking NOT found in database.');
    }

    // 2. Query total count of bookings
    const [countRows] = await conn.execute('SELECT COUNT(*) as total FROM bookings');
    console.log(`\nTotal bookings count: ${countRows[0].total}`);

    // 3. Query total count of active bookings (is_deleted = 0)
    const [activeCountRows] = await conn.execute('SELECT COUNT(*) as total_active FROM bookings WHERE is_deleted = 0');
    console.log(`Total active bookings (is_deleted = 0) count: ${activeCountRows[0].total_active}`);

    // 4. Print the 5 most recently created bookings
    const [recentBookings] = await conn.execute(
      'SELECT id, title, booking_date, created_at, is_deleted FROM bookings ORDER BY created_at DESC LIMIT 5'
    );
    console.log('\n--- 5 MOST RECENT BOOKINGS ---');
    console.table(recentBookings);

    await conn.end();
  } catch (error) {
    console.error('Error during database inspection:', error);
  }
}

inspectBooking();
