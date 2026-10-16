const { setup } = require('./helpers.js');
setup({ USE_BUILT_IN_IGNORED_SIGNATURES: true, IGNORED_SIGNATURES: [1234567] });

const test = require('node:test');
const assert = require('node:assert/strict');
const { GLOBAL_IGNORED, isIgnored, getDescription } = require('../suricata/ignoredSignatures.js');

test('built-in signatures are ignored with their description', () => {
	for (const [id, description] of Object.entries(GLOBAL_IGNORED)) {
		assert.equal(isIgnored(Number(id)), true, id);
		assert.equal(getDescription(Number(id)), description);
	}
});

test('signatures from config are ignored', () => {
	assert.equal(isIgnored(1234567), true);
	assert.equal(getDescription(1234567), 'Local config');
});

test('other signatures are not ignored', () => {
	assert.equal(isIgnored(2000001), false);
	assert.equal(getDescription(2000001), null);
});

test('built-in signature IDs are valid positive integers', () => {
	for (const id of Object.keys(GLOBAL_IGNORED)) assert.ok((/^[1-9]\d*$/).test(id), id);
});
