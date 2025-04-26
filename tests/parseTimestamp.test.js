const { parseTimestamp, MONTHS } = require('../utils/parse.js');

const TEST_CASES = [
	{ input: 'test123 2025-03-18T21:28:44.371450+01:00 purrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr', expected: '2025-03-18T20:28:44Z' },
	{ input: 'Random text 2025-03-18T21:28:44+01:00 meow meow nyaaa', expected: '2025-03-18T20:28:44Z' },
	{ input: 'Another one 2025-03-18T21:28:44 here', expected: '2025-03-18T21:28:44Z' },
	{ input: 'Something happening at 2025-03-18T21:28+01:00 today', expected: '2025-03-18T20:28:00Z' },
	{ input: 'event detected 2025-03-18T21:28:44Z event end', expected: '2025-03-18T21:28:44Z' },
	{ input: 'Mar 18 21:28:44 service started successfully', expected: 'syslog' },
	{ input: 'Mar 18 21:28 service partially started', expected: 'syslog' },
	{ input: 'Mar  8 01:02:03 strange spacing here', expected: 'syslog' },
	{ input: 'Completely invalid data string here', expected: 'now' },
	{ input: '', expected: 'now' },
	{ input: 'March 18 21:28 this is not valid', expected: 'now' },
	{ input: 'prefix text Mar 18 21:28:44 suffix text', expected: 'syslog' },
	{ input: 'Prefix prefix 2025-03-18T21:28:44.123456+02:00', expected: '2025-03-18T19:28:44Z' },
	{ input: 'Logged at Mar 18 23:59:59', expected: 'syslog' },
	{ input: 'badformat 2025-03-18 21:28:44+01:00', expected: 'now' },
];

const isApproximatelyNow = ts => {
	const now = Date.now();
	const parsed = Date.parse(ts);
	return !isNaN(parsed) && Math.abs(parsed - now) < 10000 && ts.endsWith('Z');
};

const isSyslogMatching = (input, ts) => {
	const match = input.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
	if (!match) return false;

	const [, monthStr, day, hour, minute, second = '00'] = match;
	const now = new Date();
	const expected = `${now.getUTCFullYear()}-${MONTHS[monthStr]}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}Z`;
	return ts === expected;
};

let passedCount = 0;
const failedTests = [];

TEST_CASES.forEach(({ input, expected }) => {
	const result = parseTimestamp(input);
	const passed =
		expected === 'now' ? isApproximatelyNow(result) :
			expected === 'syslog' ? isSyslogMatching(input, result) :
				result === expected;

	if (passed) {
		console.log(`${input} --> ${result} ✅`);
		passedCount++;
	} else {
		console.log(`${input} --> ${result} ❌ (expected: ${expected})`);
		failedTests.push({ input, expected, actual: result });
	}
});

console.log(`\nSummary: ${passedCount}/${TEST_CASES.length} tests passed`);

if (failedTests.length > 0) {
	console.log('\nFailed tests:');
	failedTests.forEach(({ input, expected, actual }) => {
		console.log(`- Input: ${input}`);
		console.log(`  Expected: ${expected}`);
		console.log(`  Actual:   ${actual}\n`);
	});
}