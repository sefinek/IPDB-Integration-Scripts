const parseTimestamp = require('./parseTimestamp.js');

const testCases = [
	'2025-03-18T21:28:44.371450+01:00',
	'Mar 18 21:28:44',
	'Invalid string',
];

testCases.forEach(test => {
	console.log(`${test} -->`, parseTimestamp(test));
});