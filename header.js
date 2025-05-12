const { authorEmailWebsite } = require('./repo.js');
const ENG_G = 70, START_G = 165;

const gradientText = text => {
	const len = text.length;
	return [...text].map((char, i) => {
		const g = Math.round(START_G - ((START_G - ENG_G) * i / (len - 1)));
		return `\x1b[38;2;255;${g};0m${char}`;
	}).join('');
};

module.exports = (type, header) => `\n\
    \x1b[38;2;255;140;0m   .--.        ${gradientText(header)}
    \x1b[38;2;255;140;0m.-(    ).      ${gradientText(authorEmailWebsite)}
   \x1b[38;2;255;140;0m(___.__)__)\x1b[0m
`;