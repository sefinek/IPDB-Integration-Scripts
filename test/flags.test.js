const { setup } = require('./helpers.js');
const { logger } = setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const { FLAGS, createFlagCollection } = require('../reporting/flags.js');

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

test('flags sharing the fallback ID produce it only once', () => {
	const flags = createFlagCollection().add(FLAGS.HACKING, FLAGS.PATH_TRAVERSAL, FLAGS.RDP);
	assert.deepEqual(flags.toIDs('AbuseIPDB'), [15]);
	assert.deepEqual(flags.toIDs('SniffCat'), [11, 16, 22]);
});

test('flags without an own category use the closest one, not the fallback', () => {
	assert.deepEqual(createFlagCollection().add(FLAGS.WEB_APP_ATTACK).toIDs('SniffCat'), [21]);
	assert.deepEqual(createFlagCollection().add(FLAGS.IGNORING_ROBOTS_TXT).toIDs('SniffCat'), [15]);
	assert.deepEqual(createFlagCollection().add(FLAGS.PORT_SCAN, FLAGS.IOT_TARGETED).toIDs('SniffCat'), [4, 11]);
	assert.deepEqual(createFlagCollection().add(FLAGS.PORT_SCAN, FLAGS.EMAIL_SPAM).toIDs('SniffCat'), [4, 14]);
	assert.deepEqual(createFlagCollection().add(FLAGS.MASS_SCANNER).toIDs('AbuseIPDB'), [14]);
	assert.deepEqual(createFlagCollection().add(FLAGS.IGNORING_ROBOTS_TXT).toIDs('AbuseIPDB'), [19]);
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
