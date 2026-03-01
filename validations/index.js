const { repoName } = require('../repo.js');
const validateConfig = require('./validateConfig.js');
const { rules: common, services } = require('./common.js');

const PROJECT_RULES = {
	suricata: require('./suricata.js'),
	ufw: require('./ufw.js'),
	't-pot': require('./tpot.js'),
	cloudflare: require('./cloudflare.js'),
};

const resolveByRepoName = (map, name) => {
	const lower = name.toLowerCase();
	for (const [key, value] of Object.entries(map)) {
		if (lower.includes(key)) return value;
	}
	return null;
};

module.exports = config => {
	const rules = [...common];

	const serviceConf = resolveByRepoName(services, repoName);
	if (serviceConf) {
		rules.push({ key: serviceConf.apiKey, type: String, nonEmpty: true });
		rules.push({ key: 'IP_REPORT_COOLDOWN', type: Number, min: serviceConf.minCooldown });
	}

	const projectRules = resolveByRepoName(PROJECT_RULES, repoName);
	if (projectRules) rules.push(...projectRules);

	validateConfig(config, rules);
};
