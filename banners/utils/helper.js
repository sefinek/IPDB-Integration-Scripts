'use strict';

const gradientText = require('./gradientText.js');

const IS_PM2 = 'pm_id' in process.env;

const color = code => IS_PM2 ? '' : `\x1b[38;2;${code}m`;
const reset = IS_PM2 ? '' : '\x1b[0m';

const headerText = text => IS_PM2 ? text : gradientText(text, 145, 58);
const authorText = text => IS_PM2 ? text : gradientText(text, 145, 88);

module.exports = Object.freeze({
	IS_PM2,
	color,
	reset,
	headerText,
	authorText,
	donate: '💗 If you like it, consider supporting me. I\'d really appreciate it! https://sefinek.net/donate',
	sniffcat: '📘 Report malicious addresses to the SniffCat database as well. A new and innovative alternative to AbuseIPDB: https://sniffcat.com',
});