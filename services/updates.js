// Kept only for integrations that still call it from index.js with AUTO_UPDATE_ENABLED set to true.
// Automatic updates pulled this submodule without the parent repository, so removing this file would crash them on restart.
// TODO: Remove once all integrations no longer require it.
const logger = require('../logger.js');

module.exports = async () => {
	logger.warn('Automatic updates have been removed. Update manually with \'npm run update\' when a new version is available.', { discord: true });
	require('./version.js');
};
