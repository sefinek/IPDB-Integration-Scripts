const fs = require('node:fs');
const path = require('node:path');
const ipaddr = require('ipaddr.js');
const logger = require('../logger.js');
const isSpecialPurposeIP = require('../isSpecialPurposeIP.js');

const filePath = path.resolve(__dirname, '..', '..', 'whitelist.txt');
let whitelistedIPs = new Set();
let whitelistedRanges = [];
let reloadTimer = null;

const parse = content => {
	const set = new Set();
	const ranges = [];
	const invalid = [], skipped = [];
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].split('#')[0].trim();
		if (!line) continue;

		if (line.includes('/')) {
			let cidr;
			try {
				cidr = ipaddr.parseCIDR(line);
			} catch {
				invalid.push(`${line} (line ${i + 1})`);
				continue;
			}

			const { is, range } = isSpecialPurposeIP(cidr[0].toString());
			if (is) {
				skipped.push(`${line} (${range})`);
				continue;
			}

			ranges.push(cidr);
			continue;
		}

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

	return { set, ranges };
};

const load = () => {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const { set, ranges } = parse(content);
		whitelistedIPs = set;
		whitelistedRanges = ranges;

		const total = whitelistedIPs.size + whitelistedRanges.length;
		if (total > 0) logger.info(`Loaded ${whitelistedIPs.size} whitelisted IP${whitelistedIPs.size !== 1 ? 's' : ''} and ${whitelistedRanges.length} subnet${whitelistedRanges.length !== 1 ? 's' : ''} from ${filePath}`);
	} catch (err) {
		logger.error(`Failed to load whitelist file: ${err.message}`);
	}
};

const initWhitelist = () => {
	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, '# IP Whitelist - one IP address or CIDR subnet per line\n# Lines starting with # are comments\n# Changes to this file are detected and applied automatically (no restart required)\n#\n# Useful for excluding your own IPs that are not covered by the built-in\n# self-reporting protection, e.g., your home IP when running on a VPS,\n# or a pool of your company IP addresses.\n#\n# Examples:\n# 79.186.0.0\n# 2a01:11bf:4504:b10c:8a32:ffe7:510a:6d4e\n# 79.186.0.0/24\n# 2a01:11bf:4504:b10c::/64\n');
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

const isWhitelisted = ip => {
	if (whitelistedIPs.has(ip)) return true;
	if (whitelistedRanges.length === 0) return false;

	let addr;
	try {
		addr = ipaddr.parse(ip);
	} catch {
		return false;
	}

	return whitelistedRanges.some(cidr => addr.kind() === cidr[0].kind() && addr.match(cidr));
};

module.exports = { initWhitelist, isWhitelisted };
