
const { placeManagementAPI } = require('./lib/place-management-api');

async function checkData() {
    try {
        const assignments = await placeManagementAPI.getTableData('pass_assignments', { limit: 100 });
        console.log('--- Pass Assignments (Last 10) ---');
        const sorted = assignments.sort((a, b) => new Date(b.created_at || b.assigned_date).getTime() - new Date(a.created_at || a.assigned_date).getTime());
        console.log(JSON.stringify(sorted.slice(0, 10), null, 2));

        const members = await placeManagementAPI.getTableData('external_members', { limit: 10 });
        console.log('--- External Members (First 10) ---');
        console.log(JSON.stringify(members, null, 2));
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

checkData();
