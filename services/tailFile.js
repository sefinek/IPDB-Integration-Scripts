const fs = require('node:fs');
const path = require('node:path');
const TailFile = require('@logdna/tail-file');
const split2 = require('split2');
const logger = require('../logger.js');

/**
 * Starts tailing a log file, calling onLine for each new line.
 * If the file does not exist, waits for it to be created (directory must exist).
 *
 * @param {string} filePath - Path to the log file.
 * @param {Function} onLine - Callback invoked for each new line (receives the line string).
 * @param {Object} [options]
 * @param {string} [options.label] - Label for log messages (e.g., 'DIONAEA', 'SURICATA').
 * @returns {Promise<TailFile|null>} Resolves with the TailFile instance once tailing starts, or null on error.
 */
module.exports = (filePath, onLine, options = {}) => {
	const { label } = options;
	const prefix = label ? `${label} -> ` : '';

	const start = async () => {
		const tail = new TailFile(filePath);
		const onError = err => logger.error(`${prefix}${err.message || err}`);

		tail.on('tail_error', onError);
		tail.on('error', onError);
		await tail.start();

		tail.pipe(split2()).on('data', onLine).on('error', onError);
		return tail;
	};

	if (fs.existsSync(filePath)) return start();

	const resolved = path.resolve(filePath);
	const dir = path.dirname(resolved);
	const filename = path.basename(resolved);

	if (!fs.existsSync(dir)) {
		logger.error(`${prefix}Log file directory does not exist: ${dir}`);
		return Promise.resolve(null);
	}

	logger.warn(`${prefix}Log file does not exist yet: ${filePath}. Waiting for it to be created...`);

	return new Promise(resolve => {
		const watcher = fs.watch(dir, (event, file) => {
			if (file === filename && fs.existsSync(filePath)) {
				watcher.close();
				logger.info(`${prefix}Log file detected: ${filePath}. Starting tail...`);
				resolve(start());
			}
		});

		watcher.on('error', err => {
			logger.error(`${prefix}Failed to watch directory ${dir}: ${err.message}`);
			resolve(null);
		});
	});
};
