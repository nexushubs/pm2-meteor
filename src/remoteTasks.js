/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require('path');
const nodemiral = require('nodemiral');
const cli = require('cli');
const fs = require('fs');
const async = require('async');
const _settings = require("./settings");
const CWD = process.cwd();
const abs = require("abs");

const getAppLocation = pm2mConf=> path.join(pm2mConf.server.deploymentDir, pm2mConf.appName);
const getBackupLocation = pm2mConf=> path.join(getAppLocation(pm2mConf), _settings.backupDir);

var BashCmd = (function() {
  let appendCmd = undefined;
  BashCmd = class BashCmd {
    static initClass() {
      appendCmd = function(cmd1, cmd2){
        if (cmd1) {
          return `${cmd1} && ${cmd2}`;
        } else {
          return `${cmd2}`;
        }
      };
    }
    constructor(pm2mConf, rawCmd) {
      if (pm2mConf && rawCmd) {
        this.pm2mConf = pm2mConf;
        this.rawCmd = rawCmd;
      } else {
        throw new Error("You must pass a pm2mConf and a Command string...");
      }
    }
    getString(){
      const {loadProfile, nvm} = this.pm2mConf.server;
      let result = "";
      if (loadProfile) {
        result = appendCmd(result, `[[ -r ${loadProfile} ]] && . ${loadProfile}`);
      }
      if (nvm) {
        if (nvm.bin) {
          result = appendCmd(result, `[[ -r ${nvm.bin} ]] && . ${nvm.bin}`);
        }
      }
          // if nvm.use
          //   result = appendCmd result, "nvm use #{nvm.use}"
      result = appendCmd(result, this.rawCmd);
      return result;
    }
  };
  BashCmd.initClass();
  return BashCmd;
})();

const cmdString = (pm2mConf, cmd)=> new BashCmd(pm2mConf, cmd).getString();

// Remote tasks
module.exports = {
  getRemoteSession(pm2mConf){
    const session = nodemiral.session(`${pm2mConf.server.host}`, {
      username: pm2mConf.server.username,
      password: pm2mConf.server.password ? pm2mConf.server.password : undefined,
      pem: (pm2mConf.server.pem ? fs.readFileSync(abs(pm2mConf.server.pem)) : undefined)
    }
    , {
      ssh:
        pm2mConf.server.port ? {port: pm2mConf.server.port} : undefined
    }
    );
    return session;
  },
  checkDeps(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, "(command -v node || echo 'missing node' 1>&2) && (command -v npm || echo 'missing npm' 1>&2) && (command -v pm2 || echo 'missing pm2' 1>&2)");
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr && (logs.stderr.length > 0) && /.*missing.*/.test(logs.stderr)) {
          console.log("");
          console.log(logs.stderr);
          return done({message: "Please make sure you have node, npm and pm2 installed on your remote machine!"});
        } else {
          return done();
        }
      }
    });
  },
  prepareHost(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `mkdir -p ${path.join(getAppLocation(pm2mConf), _settings.backupDir)}`);
    return session.execute(cmd, {}, function(err,code,logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr && (logs.stderr.length > 0)) {
          done({message: `${logs.stderr}`});
        }
        return done();
      }
    });
  },
  shipTarBall(session, pm2mConf, done){
    const tarLocation = path.join(CWD, _settings.bundleTarName);
    const destination = path.join(getAppLocation(pm2mConf), _settings.bundleTarName);
    console.log(tarLocation);
    console.log(destination);
    return session.copy(tarLocation, destination, {progressBar: true} , function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  },
  shipSettings(session, pm2mConf, done){
    const fileLocation = path.join(CWD, _settings.pm2EnvConfigName);
    const destination = path.join(getAppLocation(pm2mConf), _settings.pm2EnvConfigName);
    console.log(fileLocation);
    console.log(destination);
    return session.copy(fileLocation, destination, {progressBar: true} , function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  },
  extractTarBall(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `cd ${getAppLocation(pm2mConf)} && rm -rf ${_settings.bundleName} && tar -xf ${_settings.bundleTarName}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  },
  installBundleDeps(session, pm2mConf, done){
    const serverLocation = path.join(getAppLocation(pm2mConf), _settings.bundleName, "/programs/server");
    const cmd = cmdString(pm2mConf, `cd ${serverLocation} && node --version && npm i .`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  },
  startApp(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `cd ${getAppLocation(pm2mConf)} && pm2 start ${_settings.pm2EnvConfigName}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          done({message: logs.stderr});
        }
        return done();
      }
    });
  },
  stopApp(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `cd ${getAppLocation(pm2mConf)} && pm2 stop ${_settings.pm2EnvConfigName}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          done({message: logs.stderr});
        }
        return done();
      }
    });
  },

  status(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `pm2 show ${pm2mConf.appName}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          done(null, logs.stderr);
        }
        if (logs.stdout) {
          return done(null, logs.stdout);
        }
      }
    });
  },

  backupLastTar(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `cd ${getAppLocation(pm2mConf)} && mv ${_settings.bundleTarName} backup/ 2>/dev/null`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done();
      } else {
        return done();
      }
    });
  },
  killApp(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `pm2 delete ${pm2mConf.appName}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  },
  reloadApp(session, pm2mConf, reconfig, done){
    if (reconfig) {
      return this.hardReloadApp(session, pm2mConf, done);
    } else {
      return this.softReloadApp(session, pm2mConf, done);
    }
  },
  softReloadApp(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `cd ${getAppLocation(pm2mConf)} && pm2 startOrReload ${_settings.pm2EnvConfigName}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          console.log(logs.stderr);
        }
        return done();
      }
    });
  },
  hardReloadApp(session, pm2mConf, done){
    const cmd1 = cmdString(pm2mConf, `cd ${getAppLocation(pm2mConf)} && pm2 delete ${pm2mConf.appName}`);
    return session.execute(cmd1, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.sterr) {
          console.log(logs.stderr);
        }
        const cmd2 = cmdString(pm2mConf, `cd ${getAppLocation(pm2mConf)} && pm2 start ${_settings.pm2EnvConfigName}`);
        return session.execute(cmd2, {}, function(err, code, logs){
          if (err) {
            return done(err);
          } else {
            if (logs.stderr) {
              console.log(logs.stderr);
            }
            return done();
          }
        });
      }
    });
  },
  deleteAppFolder(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `rm -rf ${getAppLocation(pm2mConf)}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          console.log(logs.stder);
        }
        return done();
      }
    });
  },
  scaleApp(session, pm2mConf, sParam, done){
    const cmd = cmdString(pm2mConf, `pm2 scale ${pm2mConf.appName} ${sParam}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          done({message: logs.stderr});
        }
        if (logs.stdout) {
          console.log(logs.stdout);
        }
        return done();
      }
    });
  },
  getAppLogs(session, pm2mConf, done){
    const cmd = cmdString(pm2mConf, `pm2 logs ${pm2mConf.appName}`);
    return session.execute(cmd, {onStdout: console.log}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          return done({message: logs.stderr});
        }
      }
    });
  },
  revertToBackup(session, pm2mConf, done){
    const appLocation = getAppLocation(pm2mConf);
    const backupLocation = getBackupLocation(pm2mConf);
    const cmd = cmdString(pm2mConf, `mv ${path.join(backupLocation, _settings.bundleTarName)} ${path.join(appLocation, _settings.bundleTarName)}`);
    console.log(`executing ${cmd}`);
    return session.execute(cmd, {}, function(err, code, logs){
      if (err) {
        return done(err);
      } else {
        if (logs.stderr) {
          console.log("*** stderr while reverting to backup ***");
          done({message: logs.stderr});
        }
        if (logs.stdout) {
          console.log(logs.stdout);
        }
        return done();
      }
    });
  }
};
