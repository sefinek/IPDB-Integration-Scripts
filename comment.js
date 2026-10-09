const MAX_COMMENT_LENGTH = 1024;
const ELLIPSIS = '...';

const truncateComment = (comment, maxLength = MAX_COMMENT_LENGTH) => {
	if (typeof comment !== 'string' || comment.length <= maxLength) return comment;

	let end = Math.max(0, maxLength - ELLIPSIS.length);
	const code = comment.charCodeAt(end - 1);
	if (code >= 0xD800 && code <= 0xDBFF) end--;

	return comment.slice(0, end).trimEnd() + ELLIPSIS;
};

const joinWithinLimit = (items, maxLength, separator = ', ') => {
	const joined = items.join(separator);
	if (joined.length <= maxLength) return joined;

	let result = '';
	for (const item of items) {
		const next = result ? `${result}${separator}${item}` : item;
		if (next.length > maxLength - ELLIPSIS.length) break;
		result = next;
	}

	return result ? result + ELLIPSIS : truncateComment(items[0] ?? '', maxLength);
};

module.exports = Object.freeze({
	MAX_COMMENT_LENGTH,
	truncateComment,
	joinWithinLimit,
});
