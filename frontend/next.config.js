// /** @type {import('next').NextConfig} */
// const nextConfig = {
// 	reactStrictMode: true,
// 	env: {
// 		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
// 	},
// };
// module.exports = nextConfig;

const fs = require('fs');

module.exports = {
	reactStrictMode: true,
	// Enable HTTPS for dev server
	devServer: {
		https: {
			key: fs.readFileSync('/app/certs/localhost-key.pem'),
			cert: fs.readFileSync('/app/certs/localhost.pem'),
		},
	},
	env: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	},
};
