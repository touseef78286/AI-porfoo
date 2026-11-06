const fs = require('fs');
const code = fs.readFileSync('apps/dashboard/src/index.html','utf8');
console.log('Has setWatcherStatus: ', code.includes('setWatcherStatus') ? 'YES' : 'NO');
console.log('Has setGraphStatus: ', code.includes('setGraphStatus') ? 'YES' : 'NO');
console.log('Uses api() function: ', code.includes('api("/api') ? 'YES' : 'NO');
console.log('Watches /api/bootstrap: ', code.includes('/api/bootstrap') ? 'YES' : 'NO');
console.log('Graph fetches /api/graph: ', code.includes('/api/graph') ? 'YES' : 'NO');