/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require('path');

module.exports = {
  pm2MeteorConfigName: "pm2-meteor.json",
  tryReadPm2MeteorConfigName: "pm2-meteor",
  pm2MeteorConfigTemplate: {
    appName: "",
    appLocation: {
      local: "",
      git: "",
      branch: "master"
    },
    meteorSettingsLocation: "",
    meteorSettingsInRepo: false,
    prebuildScript: "",
    meteorBuildFlags: "",
    env: {
      ROOT_URL: "",
      PORT: 3000,
      MONGO_URL: ""
    },
    server: {
      host: "",
      username: "",
      password: "",
      deploymentDir: "/opt/meteor-apps",
      loadProfile: "",
      nvm: {
        bin: "",
        use: ""
      },
      exec_mode: "cluster_mode",
      instances: 1
    }
  },
  pm2EnvConfigName: "pm2-env.json",
  pm2EnvConfigTemplate: {
    apps: []
  },
  localBuildDir: "/tmp/pm2-meteor-builds",
  bundleTarName: "bundle.tar.gz",
  bundleName: "bundle",
  backupDir: "backup",
  gitDirName: "git-src",
  inquirerQuestions: [
    {
      type: 'input',
      name: 'appName',
      message: 'What is the app name?',
      default(){ return path.basename(process.cwd()); }
    },
    {
      type: 'input',
      name: 'appLocation',
      message: 'What is the app location? (path or git url)',
      default: './',
      filter(val){
        const rgx = new RegExp("((git|ssh|http(s)?)|(git@[\w\.]+))(:(//)?)([\w\.@\:/\-~]+)(\.git)(/)?");
        if (rgx.test(val) === true) {
          return { git: val, branch: 'master' };
        } else {
          return { local: val };
        }
      }
    },
    {
      type: 'input',
      name: 'meteorSettingsLocation',
      message: 'Where is the settings JSON file for Meteor located?',
      default(){ return path.resolve('./', 'settings.json'); }
    },
    {
      type: 'list',
      name: 'meteorBuildFlags',
      message: 'On which server architecture will your app run?',
      choices: [
        'os.linux.x86_64',
        'os.linux.x86_32',
        'os.osx.x86_64',
        'os.windows.x86_32'
      ],
      default: 'os.linux.x86_64',
      filter(val){ return `--architecture ${val}`; }
    },
    {
      type: 'input',
      name: 'rootURL',
      message: 'What will be the ROOT URL of your app?',
      default(){ return ''; }
    },
    {
      type: 'input',
      name: 'port',
      message: 'On which PORT will your app run?',
      default(){ return 3000; }
    },
    {
      type: 'input',
      name: 'mongoURL',
      message: 'What is the MongoDB connection string for your apps DB?',
      default(){ return ''; }
    },
    {
      type: 'input',
      name: 'serverHost',
      message: 'What is the host name of your production machine?',
      default(){ return ''; }
    },
    {
      type: 'input',
      name: 'serverUsername',
      message: 'Username?',
      default(){ return ''; }
    },
    {
      type: 'list',
      name: '_authMethod',
      message: 'Do you want to auth by password or by PEM file?',
      choices: [
        'password',
        'pem file'
      ]
    },
    {
      type: 'password',
      name: 'serverPassword',
      message: 'Password?',
      default(){ return ''; },
      when({ _authMethod }){
        if (_authMethod === 'password') {
          return true;
        } else {
          return false;
        }
      }
    },
    {
      type: 'input',
      name: 'serverPem',
      message: 'Where is your PEM file located?',
      default(){ return '~/.ssh/someFile.pem'; },
      when({ _authMethod }){
        if (_authMethod === 'pem file') {
          return true;
        } else {
          return false;
        }
      }
    },
    {
      type: 'input',
      name: 'serverInstances',
      message: 'How many instances?',
      default(){ return 1; }
    }
  ]
};
