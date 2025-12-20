const os = require('node:os');
const path = require('node:path');

module.exports = inputPath => {
	if (typeof inputPath !== 'string') return inputPath;

	// Replace tilde with home directory
	const expandedPath = inputPath.replace(/^~(?=$|\/|\\)/, os.homedir());

	// Return absolute path
	return path.resolve(expandedPath);
};