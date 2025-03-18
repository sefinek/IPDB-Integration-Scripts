const parseTimestamp = require('../utils/parseTimestamp.js');

const testCases = [
	'test1233333333333333333333333333333333333333333333333 2025-03-18T21:28:44.371450+01:00 purrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr meow meow maow 01283912783912839123',
	'Mar 18 21:28:44 test123 test123test123test123test123test12 purrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
	'Invalid string',
];

testCases.forEach(test => {
	console.log(`${test} -->`, parseTimestamp(test));
});