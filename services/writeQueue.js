const fs = require('node:fs/promises');
const path = require('node:path');

const queues = new Map();

const queueWrite = (filePath, fn) => {
	const key = path.resolve(filePath);
	const prev = queues.get(key) || Promise.resolve();
	const next = prev.then(fn, fn);
	queues.set(key, next);
	return next;
};

const waiting = new Map();

// For writers that serialize the current state when they start. A call made while such a write is still waiting reuses it,
// because that write will already include the caller's changes.
const queueSnapshotWrite = (filePath, fn) => {
	const key = path.resolve(filePath);
	if (waiting.has(key)) return waiting.get(key);

	const next = queueWrite(key, () => {
		waiting.delete(key);
		return fn();
	});

	waiting.set(key, next);
	return next;
};

const atomicWriteFile = async (filePath, data) => {
	const tmp = `${filePath}.tmp`;
	await fs.writeFile(tmp, data);
	await fs.rename(tmp, filePath);
};

module.exports = { queueWrite, queueSnapshotWrite, atomicWriteFile };
