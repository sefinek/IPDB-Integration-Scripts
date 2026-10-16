const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const formatTimestamp = require('../formatTimestamp.js');
const resolvePath = require('../pathResolver.js');

test('formatTimestamp returns ISO 8601 without milliseconds', () => {
	assert.equal(formatTimestamp('2026-10-15T12:34:56.789Z'), '2026-10-15T12:34:56Z');
	assert.equal(formatTimestamp('2026-10-15T12:34:56.789+0200'), '2026-10-15T10:34:56Z');
	assert.equal(formatTimestamp(Date.UTC(2026, 0, 1)), '2026-01-01T00:00:00Z');
});

test('formatTimestamp falls back to the current time for invalid input', () => {
	const before = Date.now() - 1000;
	const result = Date.parse(formatTimestamp('invalid'));
	assert.ok(result >= before && result <= Date.now());
});

test('pathResolver expands tilde to the home directory', () => {
	assert.equal(resolvePath('~'), os.homedir());
	assert.equal(resolvePath('~/cache.txt'), path.join(os.homedir(), 'cache.txt'));
});

test('pathResolver resolves relative paths and leaves non-strings unchanged', () => {
	assert.equal(resolvePath('tmp/cache.txt'), path.resolve('tmp/cache.txt'));
	assert.equal(resolvePath('~user/file'), path.resolve('~user/file'));
	assert.equal(resolvePath(null), null);
	assert.equal(resolvePath(undefined), undefined);
});
