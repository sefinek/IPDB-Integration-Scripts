const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempDir } = require('./helpers.js');
const { queueWrite, queueSnapshotWrite, atomicWriteFile } = require('../services/writeQueue.js');

test('writes to the same file run sequentially', async () => {
	const file = path.join(createTempDir(), 'queue.txt');
	const order = [];

	const slow = queueWrite(file, async () => {
		await new Promise(resolve => setTimeout(resolve, 20));
		order.push('slow');
	});
	const fast = queueWrite(file, async () => order.push('fast'));

	await Promise.all([slow, fast]);
	assert.deepEqual(order, ['slow', 'fast']);
});

test('a failed write does not block the next one', async () => {
	const file = path.join(createTempDir(), 'queue.txt');

	const failed = queueWrite(file, async () => {
		throw new Error('disk full');
	});
	const next = queueWrite(file, async () => 'ok');

	await assert.rejects(failed, /disk full/);
	assert.equal(await next, 'ok');
});

test('different paths to the same file share one queue', async () => {
	const dir = createTempDir();
	const order = [];

	const first = queueWrite(path.join(dir, 'a.txt'), async () => {
		await new Promise(resolve => setTimeout(resolve, 20));
		order.push(1);
	});
	const second = queueWrite(path.join(dir, '.', 'sub', '..', 'a.txt'), async () => order.push(2));

	await Promise.all([first, second]);
	assert.deepEqual(order, [1, 2]);
});

test('snapshot writes waiting in the queue are coalesced', async () => {
	const file = path.join(createTempDir(), 'snapshot.txt');
	let runs = 0;
	const write = () => queueSnapshotWrite(file, async () => {
		runs++;
		await new Promise(resolve => setTimeout(resolve, 10));
	});

	const first = write();
	await new Promise(resolve => setImmediate(resolve));
	const second = write();
	const third = write();

	assert.equal(second, third);
	await Promise.all([first, second, third]);
	assert.equal(runs, 2);

	await write();
	assert.equal(runs, 3);
});

test('a snapshot write waits for a regular write to the same file', async () => {
	const file = path.join(createTempDir(), 'mixed.txt');
	const order = [];

	const regular = queueWrite(file, async () => {
		await new Promise(resolve => setTimeout(resolve, 20));
		order.push('regular');
	});
	const snapshot = queueSnapshotWrite(file, async () => order.push('snapshot'));

	await Promise.all([regular, snapshot]);
	assert.deepEqual(order, ['regular', 'snapshot']);
});

test('atomicWriteFile replaces the file and leaves no temporary file', async () => {
	const dir = createTempDir();
	const file = path.join(dir, 'data.txt');

	await atomicWriteFile(file, 'first');
	await atomicWriteFile(file, 'second');

	assert.equal(fs.readFileSync(file, 'utf8'), 'second');
	assert.deepEqual(fs.readdirSync(dir), ['data.txt']);
});
