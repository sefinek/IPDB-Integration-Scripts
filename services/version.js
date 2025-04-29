const axios = require('./axios.js');
const { version, authorAndName } = require('../repo.js');
const log = require('../log.js');

const packageUrl = `https://raw.githubusercontent.com/${authorAndName}/main/package.json`;

module.exports = async () => {
	try {
		const { data: { version: latest } } = await axios.get(packageUrl);

		if (latest !== version) log(`A new version is available! Update by running 'npm run pull' or set 'AUTO_UPDATE_ENABLED' to true and restart the process.\n> ${version} → ${latest}`, 0, true);
	} catch (err) {
		log(`Failed to check version: ${err.stack}`, 3, true);
	}
};