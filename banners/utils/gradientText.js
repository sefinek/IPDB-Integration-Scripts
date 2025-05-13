module.exports = (text, startGreen, endGreen) => {
	const textLength = text.length;
	return [...text].map((char, index) => {
		const greenValue = Math.round(startGreen - ((startGreen - endGreen) * index / (textLength - 1)));
		return `\x1b[38;2;255;${greenValue};0m${char}`;
	}).join('');
};