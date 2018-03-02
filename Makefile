build:
	- rm -r lib
	babel --out-dir lib src
	echo "#! /usr/bin/env node" > lib/program.js
	cat lib/pm2-meteor.js >> lib/program.js
