const fs = require('node:fs');
const path = require('node:path');
const logger = require('../../core/logger.js');

const markerPath = path.resolve(__dirname, '../../../tmp/honeypot-warning-shown');
const warning = [
	'='.repeat(80),
	'WARNING: RUN THIS TOOL ONLY ON ISOLATED SERVERS DEDICATED TO COLLECTING',
	'UNSOLICITED TRAFFIC (HONEYPOTS). DO NOT RUN IT ON HOSTS THAT ALSO RUN OTHER',
	'SERVICES OR GENERATE REGULAR CLIENT TRAFFIC, AS THIS MAY CAUSE LEGITIMATE',
	'TRAFFIC TO BE INCORRECTLY REPORTED AS ABUSE.',
	'='.repeat(80),
].join('\n');

let shown = false;

module.exports = () => {
	if (shown) return;
	shown = true;

	try {
		fs.mkdirSync(path.dirname(markerPath), { recursive: true });
		fs.writeFileSync(markerPath, new Date().toISOString(), { flag: 'wx' });
	} catch (err) {
		if (err.code === 'EEXIST') return;
		logger.error(`Failed to save the honeypot warning marker at ${markerPath}: ${err.message}`, { discord: false });
	}

	logger.warn(warning, { highlight: true });
};
