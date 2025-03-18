const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[+-]\d{2}:\d{2}$/;
const SHORT_DATE_REGEX = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}$/;

module.exports = str => {
	if (!str) return null;

	return ISO_REGEX.test(str) || SHORT_DATE_REGEX.test(str) ? str : null;
};