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

const atomicWriteFile = async (filePath, data) => {
	const tmp = filePath + '.tmp';
	await fs.writeFile(tmp, data);
	await fs.rename(tmp, filePath);
};

module.exports = { queueWrite, atomicWriteFile };
