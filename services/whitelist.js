const fs = require('node:fs');
const path = require('node:path');
const logger = require('../logger.js');
const isSpecialPurposeIP = require('../isSpecialPurposeIP.js');

const filePath = path.resolve(__dirname, '..', '..', 'whitelist.txt');
let whitelistedIPs = new Set();
let reloadTimer = null;

const parse = content => {
	const set = new Set();
	const invalid = [], skipped = [];
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].split('#')[0].trim();
		if (!line) continue;

		const { is, range } = isSpecialPurposeIP(line);
		if (range === null) {
			invalid.push(`${line} (line ${i + 1})`);
			continue;
		}

		if (is) {
			skipped.push(`${line} (${range})`);
			continue;
		}

		set.add(line);
	}

	if (invalid.length > 0) {
		logger.warn(`Invalid IP address${invalid.length > 1 ? 'es' : ''} in whitelist, skipping: ${invalid.join(', ')}`);
	}

	if (skipped.length > 0) {
		logger.warn(`Special-purpose IP${skipped.length > 1 ? 's' : ''} detected in whitelist.txt, was this intentional? ${skipped.join(', ')}`);
	}

	return set;
};

const load = () => {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		whitelistedIPs = parse(content);
		if (whitelistedIPs.size > 0) logger.info(`Loaded ${whitelistedIPs.size} whitelisted IP${whitelistedIPs.size > 1 ? 's' : ''} from ${filePath}`);
	} catch (err) {
		logger.error(`Failed to load whitelist file: ${err.message}`);
	}
};

const initWhitelist = () => {
	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, '# IP Whitelist - one IP address per line\n# Lines starting with # are comments\n# Changes to this file are detected and applied automatically (no restart required)\n#\n# Useful for excluding your own IPs that are not covered by the built-in\n# self-reporting protection, e.g., your home IP when running on a VPS,\n# or a pool of your company IP addresses.\n#\n# Examples:\n# 79.186.0.0\n# 2a01:11bf:4504:b10c:8a32:ffe7:510a:6d4e\n');
		logger.info(`Created default whitelist file: ${filePath}`);
	}

	load();

	const dir = path.dirname(filePath);
	const filename = path.basename(filePath);

	try {
		const watcher = fs.watch(dir, (event, file) => {
			if (file !== filename) return;
			clearTimeout(reloadTimer);
			reloadTimer = setTimeout(load, 200);
		});
		watcher.on('error', err => logger.error(`Whitelist watcher error: ${err.message}`));
	} catch (err) {
		logger.error(`Failed to watch whitelist file: ${err.message}`);
	}
};

module.exports = {
	initWhitelist,
	isWhitelisted: ip => whitelistedIPs.has(ip),
};
