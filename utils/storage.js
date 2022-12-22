const fs = require('fs');

function save_services(){
    var json = JSON.stringify(global.projects);
    fs.writeFile(require('os').homedir() + '/.deployed-projects.json', json, err => {
        if (err) {
            global.logger.error(`Cannot save projects to file ~/.deployed-projects.json. Error: ${err}`);
        }
      });
}

function save_config(){
    var json = JSON.stringify(global.service_node_config);
    fs.writeFile(require('os').homedir() + '/.deployed-config.json', json, err => {
        if (err) {
            global.logger.error(`Cannot save projects to file ~/.deployed-config.json. Error: ${err}`);
        }
      });
}

module.exports = {save_services, save_config}

