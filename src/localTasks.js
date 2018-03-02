/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs');
const {exec} = require('child_process');
const path = require('path');
const nodemiral = require('nodemiral');
const url = require('url');
const abs = require('abs');
const inquirer = require('inquirer');
const _settings = require('./settings');
const CWD = process.cwd();

const isGitProject = function(pm2mConf){
  if (!pm2mConf.appLocation.local || (pm2mConf.appLocation.local.trim() === "")) {
    return true;
  } else {
    return false;
  }
};

const reapplyMeteorSettings = function(pm2mConf){
  if (isGitProject(pm2mConf) && pm2mConf.meteorSettingsInRepo) {
    if (pm2mConf.meteorSettingsLocation && (pm2mConf.meteorSettingsLocation !== "")) {
      let meteorSettingsObj = {};
      const meteorSettingsLocation = path.join(CWD, _settings.gitDirName, pm2mConf.meteorSettingsLocation);
      const pm2EnvLocation = path.join(CWD, _settings.pm2EnvConfigName);
      try {
        meteorSettingsObj = require(meteorSettingsLocation);
        const pm2EnvObj = require(pm2EnvLocation);
        pm2EnvObj.apps[0].env["METEOR_SETTINGS"] = meteorSettingsObj;
        const prettyJson = JSON.stringify(pm2EnvObj, null, 2);
        fs.writeFileSync(_settings.pm2EnvConfigName, prettyJson);
      } catch (err) {
        console.log(err.message);
        return false;
      }
    }
  }
  return true;
};

const getAppSrc =

// Local tasks
(module.exports = {
  initPM2MeteorSettings(done){
    let json = _settings.pm2MeteorConfigTemplate;
    const questions = _settings.inquirerQuestions;
    const prompt = inquirer.createPromptModule();
    const p = prompt(questions);
    return p.then(function(answers){
      const { appName, appLocation, meteorSettingsLocation, meteorBuildFlags } = answers;
      const { rootURL: ROOT_URL, port: PORT, mongoURL: MONGO_URL } = answers;
      const { serverHost: host, serverUsername: username, serverPassword: password, serverPem: pem, serverInstances: instances } = answers;
      json = Object.assign(json, { appName, appLocation, meteorSettingsLocation, meteorBuildFlags });
      json.env = Object.assign(json.env, { ROOT_URL, PORT, MONGO_URL });
      json.server = Object.assign(json.server, { host, username, password, pem, instances });
      const prettyJson = JSON.stringify(json, null, 2);
      try {
        fs.writeFileSync(_settings.pm2MeteorConfigName, prettyJson);
      } catch (err) {
        done(err);
      }
      return done();
    });
  },

  generatePM2EnvironmentSettings(pm2mConf, done){
    let err;
    const envJson = _settings.pm2EnvConfigTemplate;
    const appJson = {};
    // Fill appJson
    appJson.name = pm2mConf.appName;
    appJson.env = pm2mConf.env;
    appJson.script = path.join(pm2mConf.server.deploymentDir, pm2mConf.appName, "bundle/main.js");
    appJson.exec_mode = pm2mConf.server.exec_mode;
    appJson.instances = pm2mConf.server.instances;
    if (pm2mConf.server.log_date_format && (pm2mConf.server.log_date_format !== "")) {
      appJson.log_date_format = pm2mConf.server.log_date_format;
    }
    // get Meteor settings
    let meteorSettingsObj = {};
    if (pm2mConf.meteorSettingsLocation && !pm2mConf.meteorSettingsInRepo) {
      try {
        const meteorSettingsLocation = abs(pm2mConf.meteorSettingsLocation);
        meteorSettingsObj = JSON.parse(fs.readFileSync(meteorSettingsLocation, 'utf8'));
      } catch (error) {
        err = error;
        done(err);
      }
    }
    appJson.env["METEOR_SETTINGS"] = meteorSettingsObj;
    envJson.apps.push(appJson);
    if (pm2mConf.server.exec_mode && (pm2mConf.server.exec_mode === 'fork_mode') && (pm2mConf.server.instances > 1)) {
      if (pm2mConf.server.freePorts && (pm2mConf.server.freePorts.length >= (pm2mConf.server.instances - 1))) {
        __range__(1, pm2mConf.server.instances-1, true).forEach(function(ind){
          const anotherAppJson = JSON.parse(JSON.stringify(appJson));
          anotherAppJson.name = `${anotherAppJson.name}-${ind+1}`;
          anotherAppJson.env.PORT = pm2mConf.server.freePorts[ind-1];
          anotherAppJson.instances = 1;
          return envJson.apps.push(anotherAppJson);
        });

        envJson.apps[0].name = `${envJson.apps[0].name}-1`;
        envJson.apps[0].instances = 1;
      } else {
        done(new Error('You should define server.freePorts with min. as much ports as server.instances!'));
      }
    }

    const prettyJson = JSON.stringify(envJson, null, 2);
    try {
      fs.writeFileSync(_settings.pm2EnvConfigName, prettyJson);
    } catch (error1) {
      err = error1;
      done({message: `${err.message}`});
    }
    return done();
  },
  bundleApplication(pm2mConf, done){
    if (isGitProject(pm2mConf)) {
      return this.bundleGitApplication(pm2mConf, done);
    } else {
      return this.bundleLocalApplication(pm2mConf, done);
    }
  },
  bundleLocalApplication(pm2mConf, done){
    let buildScript = "";
    if (pm2mConf.prebuildScript && (pm2mConf.prebuildScript.trim() !== "")) {
      buildScript  += `cd ${abs(pm2mConf.appLocation.local)} && ${pm2mConf.prebuildScript} && `;
    }
    buildScript += `cd ${abs(pm2mConf.appLocation.local)} && meteor build ${pm2mConf.meteorBuildFlags} --directory ${CWD}`;
    return exec(buildScript, function(err, stdout, stderr){
      if (err) {
        return done(err);
      } else {
        buildScript = `cd ${CWD} && tar -zcvf ${_settings.bundleTarName} ${_settings.bundleName} ${_settings.pm2EnvConfigName}`;
        return exec(buildScript, {maxBuffer: 1024*200000}, function(err, stdout, stderr){
          if (err) {
            return done(err);
          } else {
            return done();
          }
        });
      }
    });
  },
  bundleGitApplication(pm2mConf, done){
    return exec(`cd ${CWD} && git clone ${pm2mConf.appLocation.git} --branch ${pm2mConf.appLocation.branch} ${_settings.gitDirName}`, function(err, stdout, stderr){
      if (err) {
        return done(err);
      } else {
        if (reapplyMeteorSettings(pm2mConf) === false) {
          return done({message: "Something went wrong wihile building METEOR_SETTINGS" });
        } else {
          let buildScript = `cd ${path.join(CWD, _settings.gitDirName)} `;
          if (pm2mConf.prebuildScript && (pm2mConf.prebuildScript.trim() !== "")) {
            buildScript  += `&& ${pm2mConf.prebuildScript} `;
          }
          buildScript  += `&& meteor build ${pm2mConf.meteorBuildFlags} --directory ${CWD}`;
          return exec(buildScript, function(err, sdout, stderr){
            if (err) {
              return done(err);
            } else {
              return exec(`cd ${CWD} && tar -zcvf ${_settings.bundleTarName} ${_settings.bundleName} ${_settings.pm2EnvConfigName}`, {maxBuffer: 1024*200000}, function(err, stdout, stderr){
                if (err) {
                  return done(err);
                } else {
                  return done();
                }
              });
            }
          });
        }
      }
    });
  },
  makeClean(done){
    return exec(`cd ${CWD} && rm -rf ${_settings.bundleName} && rm ${_settings.pm2EnvConfigName} && rm ${_settings.bundleTarName} && rm -rf ${_settings.gitDirName}`, function(err, stdout, stderr){
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  },
  makeCleanAndLeaveBundle(done){
    return exec(`cd ${CWD} && rm -rf ${_settings.bundleName} && rm ${_settings.pm2EnvConfigName} && rm -rf ${_settings.gitDirName}`, function(err, stdout, stderr){
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  }
});

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}