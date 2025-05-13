const gradientText = require('./gradientText.js');

const IS_PM2 = 'pm_id' in process.env;

const color = code => IS_PM2 ? '' : `\x1b[38;2;${code}m`;
const reset = IS_PM2 ? '' : '\x1b[0m';

const headerText = text => IS_PM2 ? text : gradientText(text, 145, 55);
const authorText = text => IS_PM2 ? text : gradientText(text, 145, 85);

module.exports = {
	IS_PM2,
	color,
	reset,
	headerText,
	authorText,
};