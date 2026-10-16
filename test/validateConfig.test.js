const { setup } = require('./helpers.js');
const { logger } = setup();

const test = require('node:test');
const assert = require('node:assert/strict');
const validateConfig = require('../validations/validateConfig.js');

// validateConfig() calls process.exit(1) on invalid values
const validate = (t, config, rules) => {
	t.mock.method(process, 'exit', code => {
		throw new Error(`process.exit(${code})`);
	});

	validateConfig(config, rules);
	return config;
};

const lastError = () => logger.messages.error.at(-1);

test('valid config passes', t => {
	const config = { NAME: 'x', COUNT: 5, ENABLED: true, LIST: ['a'] };
	assert.doesNotThrow(() => validate(t, config, [
		{ key: 'NAME', type: String, nonEmpty: true },
		{ key: 'COUNT', type: Number, min: 1, max: 10 },
		{ key: 'ENABLED', type: Boolean },
		{ key: 'LIST', type: Array, nonEmpty: true, oneOf: ['a', 'b'] },
	]));
});

test('missing required keys are rejected, optional keys are allowed', t => {
	assert.doesNotThrow(() => validate(t, {}, [{ key: 'OPTIONAL', type: String, required: false }]));
	assert.throws(() => validate(t, {}, [{ key: 'REQUIRED', type: String }]), /process\.exit\(1\)/);
	assert.match(lastError(), /'REQUIRED' is required but is undefined/);
	assert.throws(() => validate(t, { REQUIRED: null }, [{ key: 'REQUIRED', type: String }]));
	assert.match(lastError(), /is null/);
});

test('defaults are assigned for undefined and null values', t => {
	const config = validate(t, { B: null }, [
		{ key: 'A', type: String, default: 'review' },
		{ key: 'B', type: Array, default: ['alert'] },
	]);

	assert.equal(config.A, 'review');
	assert.deepEqual(config.B, ['alert']);
});

test('wrong types are rejected', t => {
	for (const [value, type] of [['1', Number], [1, String], ['true', Boolean], ['a', Array]]) {
		assert.throws(() => validate(t, { KEY: value }, [{ key: 'KEY', type }]), /process\.exit/);
	}
});

test('numbers must be finite and within range', t => {
	const rules = [{ key: 'COOLDOWN', type: Number, min: 900000, max: 86400000 }];
	for (const value of [NaN, Infinity, -Infinity, 899999, 86400001]) {
		assert.throws(() => validate(t, { COOLDOWN: value }, rules), /process\.exit/, String(value));
	}
	assert.doesNotThrow(() => validate(t, { COOLDOWN: 900000 }, rules));
});

test('nonEmpty rejects blank strings and empty arrays', t => {
	assert.throws(() => validate(t, { KEY: '   ' }, [{ key: 'KEY', type: String, nonEmpty: true }]));
	assert.throws(() => validate(t, { KEY: [] }, [{ key: 'KEY', type: Array, nonEmpty: true }]));
});

test('oneOf is enforced for values and array items', t => {
	assert.throws(() => validate(t, { MODE: 'x' }, [{ key: 'MODE', type: String, oneOf: ['static', 'dynamic'] }]));
	assert.throws(() => validate(t, { LIST: ['alert', 'x'] }, [{ key: 'LIST', type: Array, oneOf: ['alert', 'drop'] }]));
	assert.match(lastError(), /invalid value\(s\): x/);
});

test('all errors are reported at once', t => {
	assert.throws(() => validate(t, { A: 1 }, [{ key: 'A', type: String }, { key: 'B', type: Number }]));
	assert.match(lastError(), /validation failed \(2\)/);
});

test('invalid rule definitions throw instead of exiting', t => {
	for (const rules of [
		[{ key: 'A', type: Object }],
		[{ key: '', type: String }],
		[{ key: 'A', type: String, unknownOption: true }],
		[{ key: 'A', type: Boolean, min: 1 }],
		[{ key: 'A', type: Number, min: 10, max: 1 }],
		[{ key: 'A', type: String, default: 1 }],
		[{ key: 'A', type: String, oneOf: ['x'], default: 'y' }],
	]) {
		assert.throws(() => validate(t, {}, rules), /Invalid validation rules/, JSON.stringify(rules));
	}
});
