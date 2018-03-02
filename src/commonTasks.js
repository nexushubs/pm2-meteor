/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs');
const cli = require('cli');
const _settings = require('./settings');
const CWD = process.cwd();
const path = require('path');

module.exports = {
  readPM2MeteorConfig(){
    let conf = null;
    try {
      conf = require(path.resolve(CWD, _settings.tryReadPm2MeteorConfigName));
      return conf;
    } catch (err) {
      return cli.fatal(`Error while trying to read pm2-meteor config ${err.message}`);
    }
  }
};
