const fs = require('node:fs');
const ipaddr = require('ipaddr.js');

// vars.address-groups.HOME_NET in suricata.yaml, e.g.: HOME_NET: "[10.0.0.0/8,!10.0.5.0/24,2001:db8::/48]"
const HOME_NET_LINE = /^[ \t]*HOME_NET:[ \t]*(["']?)(.*?)\1[ \t]*(?:#.*)?$/gm;

const parseNetwork = value => {
	if (!value.includes('/')) {
		const address = ipaddr.parse(value);
		return [address, address.kind() === 'ipv4' ? 32 : 128];
	}

	const network = ipaddr.parseCIDR(value);
	if (network[1] === 0) throw new Error('Default routes are not allowed');
	return network;
};

const parseHomeNet = value => {
	const list = value.trim().replace(/^\[(.*)\]$/, '$1');
	if (!list || (/[[\]$]/).test(list) || (/(^|,)\s*!?any\s*(,|$)/i).test(list)) {
		throw new Error(`Unsupported HOME_NET value "${value}". Only IP addresses and CIDR subnets (optionally negated with '!') are supported.`);
	}

	const include = { ipv4: [], ipv6: [] };
	const exclude = { ipv4: [], ipv6: [] };
	const networks = [];

	for (const item of list.split(',').map(entry => entry.trim()).filter(Boolean)) {
		const negated = item.startsWith('!');
		const cidr = negated ? item.slice(1).trim() : item;

		let network;
		try {
			network = parseNetwork(cidr);
		} catch (err) {
			throw new Error(`Invalid HOME_NET entry "${item}"`, { cause: err });
		}

		(negated ? exclude : include)[network[0].kind()].push(network);
		networks.push(item);
	}

	if (!include.ipv4.length && !include.ipv6.length) throw new Error('HOME_NET does not contain any network');

	// Expects a normalized address
	const contains = ip => {
		const address = ipaddr.parse(ip);
		const kind = address.kind();
		return include[kind].some(network => address.match(network)) && !exclude[kind].some(network => address.match(network));
	};

	return Object.freeze({ networks, contains });
};

const loadHomeNet = filePath => {
	let content;
	try {
		content = fs.readFileSync(filePath, 'utf8');
	} catch (err) {
		throw new Error(`Cannot read ${filePath}. The user running this script must have read access to it (e.g. by being a member of the 'suricata' group), or set HOME_NET in config.js.`, { cause: err });
	}

	const matches = [...content.matchAll(HOME_NET_LINE)];
	if (!matches.length) throw new Error(`HOME_NET was not found in ${filePath}`);
	if (matches.length > 1) throw new Error(`HOME_NET is defined ${matches.length} times in ${filePath}`);

	try {
		return parseHomeNet(matches[0][2]);
	} catch (err) {
		throw new Error(`Invalid HOME_NET in ${filePath}`, { cause: err });
	}
};

module.exports = { loadHomeNet, parseHomeNet };
