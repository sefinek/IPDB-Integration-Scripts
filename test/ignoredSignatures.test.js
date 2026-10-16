const { setup } = require('./helpers.js');
const { logger } = setup({ USE_BUILT_IN_IGNORED_SIGNATURES: true, IGNORED_SIGNATURES: [1234567, ' 7654321 ', 'abc', -5, 1.5, null] });

const test = require('node:test');
const assert = require('node:assert/strict');
const { GLOBAL_IGNORED, isIgnored, getDescription } = require('../suricata/ignoredSignatures.js');

test('built-in signatures are ignored with their description', () => {
	for (const [id, description] of Object.entries(GLOBAL_IGNORED)) {
		assert.equal(isIgnored(Number(id)), true, id);
		assert.equal(getDescription(Number(id)), description);
	}
});

test('signatures from config are ignored, also when given as numeric strings', () => {
	for (const id of [1234567, 7654321]) {
		assert.equal(isIgnored(id), true, String(id));
		assert.equal(getDescription(id), 'Local config');
	}
});

test('invalid entries in IGNORED_SIGNATURES are skipped and reported', () => {
	assert.equal(logger.messages.warn.length, 1);
	assert.match(logger.messages.warn[0], /IGNORED_SIGNATURES, skipping: abc, -5, 1\.5, null$/);
});

test('other signatures and object prototype keys are not ignored', () => {
	assert.equal(isIgnored(2000001), false);
	assert.equal(getDescription(2000001), null);
	assert.equal(isIgnored('toString'), false);
	assert.equal(isIgnored('constructor'), false);
});

test('built-in signature IDs are valid positive integers', () => {
	for (const id of Object.keys(GLOBAL_IGNORED)) assert.ok((/^[1-9]\d*$/).test(id), id);
});
