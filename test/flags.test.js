const { setup } = require('./helpers.js');
const { logger } = setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const { FLAGS, createFlagCollection } = require('../flags.js');

test('an empty collection falls back to the default category', () => {
	const flags = createFlagCollection();
	assert.deepEqual(flags.toIDs('SniffCat'), [27]);
	assert.deepEqual(flags.toIDs('AbuseIPDB'), [15]);
	assert.deepEqual(flags.list(), []);
});

test('flags are mapped to the IDs of each integration', () => {
	const flags = createFlagCollection().add(FLAGS.DDOS_ATTACK, FLAGS.PHISHING, FLAGS.PORT_SCAN);
	assert.deepEqual(flags.list(), ['DDOS_ATTACK', 'PHISHING', 'PORT_SCAN']);
	assert.deepEqual(flags.toIDs('SniffCat'), [3, 10, 4]);
	assert.deepEqual(flags.toIDs('AbuseIPDB'), [4, 7, 14]);
	assert.equal(flags.toString('AbuseIPDB'), '4,7,14');
});

test('flags missing in an integration use its fallback ID', () => {
	const flags = createFlagCollection().add(FLAGS.EMAIL, FLAGS.FRAUD_VOIP);
	assert.deepEqual(flags.toIDs('SniffCat'), [20, 27]);
	assert.deepEqual(flags.toIDs('AbuseIPDB'), [15, 8]);
});

test('duplicate flags are added only once', () => {
	const flags = createFlagCollection().add(FLAGS.SSH, FLAGS.SSH).add(FLAGS.SSH);
	assert.deepEqual(flags.list(), ['SSH']);
});

test('invalid flags are ignored and logged', () => {
	const flags = createFlagCollection().add('NOT_A_FLAG');
	assert.deepEqual(flags.list(), []);
	assert.ok(logger.messages.warn.some(msg => msg.includes('NOT_A_FLAG')));
});

test('unsupported integrations throw', () => {
	assert.throws(() => createFlagCollection().toIDs('UnknownSystem'), /Unsupported integration/);
});
