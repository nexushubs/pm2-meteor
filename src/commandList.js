/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const cli = require('cli');
const async = require('async');
const localTasks = require('./localTasks');
const commonTasks = require('./commonTasks');
const remoteTasks = require('./remoteTasks');
const _settings = require('./settings');

// CLI commands
module.exports = {
  init(){
    return localTasks.initPM2MeteorSettings(function(err){
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.info(`${_settings.pm2MeteorConfigName} created!`, true);
      }
    });
  },
  deploy(reconfig){
    cli.spinner("Building your app and deploying to host machine");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb => remoteTasks.checkDeps(session, pm2mConf, cb),
      cb => remoteTasks.prepareHost(session, pm2mConf, cb),
      cb => localTasks.generatePM2EnvironmentSettings(pm2mConf, cb),
      cb => localTasks.bundleApplication(pm2mConf, cb),
      cb => remoteTasks.backupLastTar(session, pm2mConf, cb),
      cb => remoteTasks.shipTarBall(session, pm2mConf, cb),
      cb => remoteTasks.extractTarBall(session, pm2mConf, cb),
      cb => remoteTasks.installBundleDeps(session, pm2mConf, cb),
      cb => remoteTasks.reloadApp(session, pm2mConf, reconfig, cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        localTasks.makeClean(function(err){ if (err) { return cli.error(err); } });
        return cli.fatal(`${err.message}`);
      } else {
        localTasks.makeClean(function(err){ if (err) { return cli.error(err); } });
        return cli.ok("Deployed your app on the host machine!");
      }
    });
  },
  reconfig(){
    cli.spinner("Deploying new env");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb => localTasks.generatePM2EnvironmentSettings(pm2mConf, cb),
      cb => remoteTasks.shipSettings(session, pm2mConf, cb),
      cb => remoteTasks.reloadApp(session, pm2mConf, true, cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        localTasks.makeClean(err=> null);
        return cli.fatal(`${err.message}`);
      } else {
        localTasks.makeClean(err=> null);
        return cli.ok("Deployed new env settings");
      }
    });
  },
  start(){
    cli.spinner("Starting app on host machine");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb=> remoteTasks.startApp(session, pm2mConf, cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.ok("Started your app!");
      }
    });
  },
  stop(){
    cli.spinner("Stopping app on host machine");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb=> remoteTasks.stopApp(session, pm2mConf, cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.ok("Stopped your app!");
      }
    });
  },
  status(){
    cli.spinner("Checking status");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb=> remoteTasks.status(session, pm2mConf, cb)
    ], function(err, result){
      cli.spinner("", true);
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.info(result);
      }
    });
  },
  generateBundle(){
    cli.spinner("Generating bundle with pm2-env file");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    return async.series([
      cb => localTasks.generatePM2EnvironmentSettings(pm2mConf, cb),
      cb => localTasks.bundleApplication(pm2mConf, cb),
      cb => localTasks.makeCleanAndLeaveBundle(cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.ok(`Generated ${_settings.bundleTarName} with pm2-env file`);
      }
    });
  },
  undeploy(){
    cli.spinner("Undeploying your App");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    if (!pm2mConf.allowUndeploy || (pm2mConf.allowUndeploy !== true)) {
      cli.fatal("Please set ´allowUndeploy´ to true in your pm2-meteor settings file!");
    }
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb => remoteTasks.killApp(session, pm2mConf, cb),
      cb => remoteTasks.deleteAppFolder(session, pm2mConf, cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.ok("Undeployed your App!");
      }
    });
  },
  scale(opts){
    cli.spinner("Scaling your App");
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb=> remoteTasks.scaleApp(session, pm2mConf, opts, cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.ok("Scaled your App");
      }
    });
  },
  logs(){
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb=> remoteTasks.getAppLogs(session, pm2mConf, cb)
    ], function(err){
      if (err) {
        return cli.fatal(`${err.message}`);
      }
    });
  },
  revert(){
    const pm2mConf = commonTasks.readPM2MeteorConfig();
    const session = remoteTasks.getRemoteSession(pm2mConf);
    return async.series([
      cb => remoteTasks.revertToBackup(session, pm2mConf, cb),
      cb => remoteTasks.extractTarBall(session, pm2mConf, cb),
      cb => remoteTasks.installBundleDeps(session, pm2mConf, cb),
      cb => remoteTasks.reloadApp(session, pm2mConf, true, cb)
    ], function(err){
      cli.spinner("", true);
      if (err) {
        return cli.fatal(`${err.message}`);
      } else {
        return cli.ok("Reverted and hard-restarted your app.");
      }
    });
  }
};
