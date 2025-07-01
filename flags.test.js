const { createFlagCollection } = require('./flags.js');

const flags = createFlagCollection();

// No flags added — expect default fallbacks:
console.log(flags.toIDs('SniffCat')); // [27]
console.log(flags.toIDs('AbuseIPDB')); // [15]
// console.log(flags.toIDs('UnknownSystem'));

// Add some flags that are mapped in both systems:
flags.add('DDOS_ATTACK', 'PHISHING', 'PORT_SCAN');

console.log(flags.list()); // ['DDOS_ATTACK', 'PHISHING', 'PORT_SCAN']

console.log(flags.toIDs('SniffCat')); // [3, 10, 4]
console.log(flags.toIDs('AbuseIPDB')); // [4, 7, 14]
console.log(flags.toString('AbuseIPDB')); // "4,7,14"

// Add a flag that doesn't exist in AbuseIPDB:
flags.add('EMAIL'); // Present in SniffCat only

console.log(flags.toIDs('SniffCat')); // [3, 10, 4, 20]
console.log(flags.toIDs('AbuseIPDB')); // [4, 7, 14, 15] ← fallback 15 for 'EMAIL'

// Add a flag that only exists in AbuseIPDB:
flags.add('FRAUD_VOIP'); // Present in AbuseIPDB only

console.log(flags.toIDs('AbuseIPDB')); // [4, 7, 14, 15, 8]
console.log(flags.toIDs('SniffCat')); // [3, 10, 4, 20, 27] ← fallback 27 for 'FRAUD_VOIP'

// Unknown integration
// console.log(flags.toIDs('UnknownSystem')); // []