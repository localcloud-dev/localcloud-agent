const dotenv = require('dotenv');
dotenv.config();

const exec = require('child_process').exec;
const osutils = require('os-utils');
const disk = require('diskusage');

//Update stats from containers
var stats = {};
stats.cluster = {};
stats.projects = {};

function getStats() {

    osutils.cpuUsage(function (cpuusage) {
      disk.check('/', function (err, info) {
        if (err) {
          console.log(err);
          stats.cluster = {};
        } else {
          stats.cluster.diskAvailable = info.available; //bytes
          stats.cluster.diskFree = info.free; //bytes
          stats.cluster.diskTotal = info.total; //bytes
        }
        stats.cluster.cpuCount = osutils.cpuCount();
        stats.cluster.cpuUsage = cpuusage;
        stats.cluster.totalmem = osutils.totalmem(); //MB
        stats.cluster.freemem = osutils.freemem(); //MB
        stats.cluster.freememPercentage = osutils.freememPercentage();
        stats.cluster.sysUptime = osutils.sysUptime(); //ms
        stats.cluster.loadavg = osutils.loadavg(); //%
      });
  
    });
    exec(`docker stats --no-stream --format "{{ json . }}"`, (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      stats.projects = JSON.parse(`[${stdout.replaceAll(`}\n{`, `},{`)}]`);
      console.log(stats.projects[0]);
    });

    String.prototype.replaceAll = function (str1, str2, ignore) {
      return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "\\$&"), (ignore ? "gi" : "g")), (typeof (str2) == "string") ? str2.replace(/\$/g, "$$$$") : str2);
    }
  
  }

  module.exports = { getStats };
