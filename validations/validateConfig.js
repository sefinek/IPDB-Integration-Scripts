const path = require('node:path');
const logger = require('../logger.js');

const configPath = path.resolve(__dirname, '..', '..', 'config.js');

const TYPE_NAMES = new Map([
	[String, 'string'],
	[Number, 'number'],
	[Boolean, 'boolean'],
	[Array, 'array'],
]);

const RULE_SCHEMA = {
	key: { type: 'string', required: true },
	type: { required: true },
	required: { type: 'boolean' },
	nonEmpty: { type: 'boolean', validFor: ['string', 'array'] },
	oneOf: { isArray: true },
	min: { type: 'number', validFor: ['number', 'array'] },
	max: { type: 'number', validFor: ['number'] },
	default: {},
};

const VALID_RULE_KEYS = new Set(Object.keys(RULE_SCHEMA));

/**
 * Validates a rule definition itself before using it to check config values.
 * @param {Object} rule
 * @param {number} index
 * @returns {string[]} Array of error messages (empty if valid).
 */
const validateRule = (rule, index) => {
	const errors = [];

	const prefix = `Rule #${index}`;
	if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return [`${prefix}: must be a plain object`];

	const unknownKeys = Object.keys(rule).filter(k => !VALID_RULE_KEYS.has(k));
	if (unknownKeys.length > 0) errors.push(`${prefix} (${rule.key || '?'}): unknown properties: ${unknownKeys.join(', ')}`);

	if (typeof rule.key !== 'string' || rule.key.length === 0) {
		return [...errors, `${prefix}: 'key' must be a non-empty string`];
	}

	const label = `${prefix} (${rule.key})`;
	const typeName = TYPE_NAMES.get(rule.type);
	if (!typeName) return [...errors, `${label}: 'type' must be String, Number, Boolean, or Array`];

	// Validate rule property types and applicability
	for (const [prop, schema] of Object.entries(RULE_SCHEMA)) {
		if (rule[prop] === undefined || prop === 'key' || prop === 'type' || prop === 'default') continue;

		if (schema.type && typeof rule[prop] !== schema.type) {
			errors.push(`${label}: '${prop}' must be ${schema.type}, got ${typeof rule[prop]}`);
		} else if (schema.isArray && !Array.isArray(rule[prop])) {
			errors.push(`${label}: '${prop}' must be an array`);
		}

		if (schema.validFor && !schema.validFor.includes(typeName)) {
			errors.push(`${label}: '${prop}' is only valid for ${schema.validFor.join(' and ')} types`);
		}
	}

	if (rule.min !== undefined && rule.max !== undefined && typeName === 'number' && rule.min > rule.max) {
		errors.push(`${label}: 'min' (${rule.min}) cannot be greater than 'max' (${rule.max})`);
	}

	// Validate default value
	if ('default' in rule) {
		const def = rule.default;
		const isCorrectType = typeName === 'array' ? Array.isArray(def) : typeof def === typeName;

		if (!isCorrectType) {
			errors.push(`${label}: 'default' must be ${typeName === 'array' ? 'an array' : `of type '${typeName}'`}, got '${typeof def}'`);
		} else {
			if (rule.nonEmpty && (typeName === 'array' ? def.length === 0 : typeof def === 'string' && def.trim().length === 0)) {
				errors.push(`${label}: 'default' must not be empty`);
			}
			if (rule.oneOf && Array.isArray(rule.oneOf)) {
				if (typeName === 'array') {
					const invalid = def.filter(v => !rule.oneOf.includes(v));
					if (invalid.length > 0) errors.push(`${label}: 'default' contains invalid value(s): ${invalid.join(', ')}`);
				} else if (!rule.oneOf.includes(def)) {
					errors.push(`${label}: 'default' must be one of ${rule.oneOf.join(', ')}, got '${def}'`);
				}
			}
		}
	}

	return errors;
};

/**
 * @param {Object} config - The configuration object to validate (e.g., config.MAIN).
 * @param {Array<Object>} rules - Array of validation rules.
 * @param {string} rules[].key - The config key to validate.
 * @param {Function} rules[].type - Expected type constructor: String, Number, Boolean, Array.
 * @param {boolean} [rules[].required=true] - Whether the key must be present and non-null.
 * @param {boolean} [rules[].nonEmpty] - For strings/arrays: must not be empty.
 * @param {Array} [rules[].oneOf] - Allowed values (for primitive types) or allowed items (for arrays).
 * @param {number} [rules[].min] - Minimum value (for numbers) or minimum length (for arrays).
 * @param {number} [rules[].max] - Maximum value (for numbers).
 * @param {*} [rules[].default] - Default value to assign if the key is undefined or null.
 */
const validateConfig = (config, rules) => {
	const ruleErrors = rules.flatMap((rule, i) => validateRule(rule, i));
	if (ruleErrors.length > 0) throw new Error(`Invalid validation rules:\n${ruleErrors.map(e => `    - ${e}`).join('\n')}`);

	const errors = [];

	for (const rule of rules) {
		const { key, required = true, nonEmpty, oneOf, min, max } = rule;
		const value = config[key];
		const typeName = TYPE_NAMES.get(rule.type);

		if (value === undefined || value === null) {
			if ('default' in rule) {
				config[key] = rule.default;
				continue;
			}
			if (required) errors.push(`'${key}' is required but is ${value === null ? 'null' : 'undefined'}`);
			continue;
		}

		if (typeName === 'array') {
			if (!Array.isArray(value)) {
				errors.push(`'${key}' must be an array, got ${typeof value}`);
				continue;
			}

			if (nonEmpty && value.length === 0) {
				errors.push(`'${key}' must be a non-empty array`);
			}

			if (typeof min === 'number' && value.length < min) {
				errors.push(`'${key}' must have at least ${min} item(s), got ${value.length}`);
			}

			if (oneOf) {
				const invalid = value.filter(v => !oneOf.includes(v));
				if (invalid.length > 0) errors.push(`'${key}' contains invalid value(s): ${invalid.join(', ')}. Allowed: ${oneOf.join(', ')}`);
			}
		} else {
			if (typeof value !== typeName) {
				errors.push(`'${key}' must be of type '${typeName}', got '${typeof value}'`);
				continue;
			}

			if (typeName === 'string' && nonEmpty && value.trim().length === 0) {
				errors.push(`'${key}' must be a non-empty string`);
			}

			if (typeName === 'number') {
				if (typeof min === 'number' && value < min) errors.push(`'${key}' must be >= ${min}, got ${value}`);
				if (typeof max === 'number' && value > max) errors.push(`'${key}' must be <= ${max}, got ${value}`);
			}

			if (oneOf && !oneOf.includes(value)) {
				errors.push(`'${key}' must be one of ${oneOf.join(', ')}, got '${value}'`);
			}
		}
	}

	if (errors.length > 0) {
		logger.error(`Configuration validation failed (${errors.length}). Please check your config file: ${configPath}\n${errors.map(e => `    - ${e}`).join('\n')}`, { discord: false });
		process.exit(1);
	}
};

module.exports = validateConfig;
