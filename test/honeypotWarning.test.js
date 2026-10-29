const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../banners/utils/honeypotWarning.js'), 'utf8');

const loadWarning = (installDir, fileSystem = fs) => {
	const warnings = [], errors = [];
	const module = { exports: {} };
	vm.runInNewContext(source, {
		module,
		__dirname: path.join(installDir, 'scripts/banners/utils'),
		require: name => {
			if (name === 'node:fs') return fileSystem;
			if (name === 'node:path') return path;
			if (name === '../../core/logger.js') return {
				warn: (...args) => warnings.push(args),
				error: (...args) => errors.push(args),
			};
			throw new Error(`Unexpected import: ${name}`);
		},
	});
	return { show: module.exports, warnings, errors };
};

const createInstall = t => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'honeypot-warning-'));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
};

test('shows one uppercase, highlighted warning with borders and persists it across restarts', t => {
	const dir = createInstall(t);
	const first = loadWarning(dir);
	first.show();
	first.show();
	assert.equal(first.warnings.length, 1);
	assert.equal(first.errors.length, 0);
	const [message, options] = first.warnings[0];
	assert.equal(message, message.toUpperCase());
	assert.equal(message.split('\n')[0], '='.repeat(80));
	assert.equal(message.split('\n').at(-1), '='.repeat(80));
	assert.equal(options.highlight, true);
	assert.equal(fs.existsSync(path.join(dir, 'tmp/honeypot-warning-shown')), true);
	const restarted = loadWarning(dir);
	restarted.show();
	assert.equal(restarted.warnings.length, 0);
	assert.equal(restarted.errors.length, 0);
});

test('each installation receives its own warning', t => {
	for (const dir of [createInstall(t), createInstall(t)]) {
		const instance = loadWarning(dir);
		instance.show();
		assert.equal(instance.warnings.length, 1);
	}
});

test('reports persistence errors and still shows the warning only once in the process', t => {
	const failure = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
	const instance = loadWarning(createInstall(t), { mkdirSync() { throw failure; } });
	instance.show();
	instance.show();
	assert.equal(instance.warnings.length, 1);
	assert.equal(instance.errors.length, 1);
	assert.match(instance.errors[0][0], /Permission denied/);
	assert.equal(instance.errors[0][1].discord, false);
});
