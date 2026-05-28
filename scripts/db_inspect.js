const mysql = require('mysql2/promise');

async function findTableAllDbs() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      port: 3306
    });

    const [dbs] = await connection.execute('SHOW DATABASES');
    await connection.end();

    for (const dbObj of dbs) {
      const db = dbObj.Database;
      if (['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db)) continue;

      try {
        const conn = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: '',
          database: db,
          port: 3306
        });

        const [tables] = await conn.execute(`SHOW TABLES LIKE 'external_members'`);
        if (tables.length > 0) {
          console.log(`Found external_members in database: ${db}`);
          const [columns] = await conn.execute('DESCRIBE external_members');
          console.log('Columns:');
          console.log(columns);
          await conn.end();
          return;
        }

        // Let's also print other tables in this DB to see if it's our VMS database
        const [allTables] = await conn.execute('SHOW TABLES');
        if (allTables.some(t => Object.values(t)[0].includes('booking'))) {
          console.log(`Database "${db}" has booking-related tables:`, allTables.map(t => Object.values(t)[0]));
        }

        await conn.end();
      } catch (e) {
        // ignore
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

findTableAllDbs();
