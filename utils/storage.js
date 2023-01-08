const fs = require('fs');

function save_services(){
    var json = JSON.stringify(global.services);
    fs.writeFile(require('os').homedir() + '/.deployed-services.json', json, err => {
        if (err) {
            global.logger.error(`Cannot save projects to file ~/.deployed-services.json. Error: ${err}`);
        }
      });
}

function save_tunnels(){
    var json = JSON.stringify(global.tunnels);
    fs.writeFile(require('os').homedir() + '/.deployed-tunnels.json', json, err => {
        if (err) {
            global.logger.error(`Cannot save projects to file ~/.deployed-tunnels.json. Error: ${err}`);
        }
      });
}

function save_config(){

    //We should "hide" api_token before saving and "show" it again after saving
    const api_token = global.service_node_config.api_token;
    global.service_node_config.api_token = null;
    
    var json = JSON.stringify(global.service_node_config);
    global.service_node_config.api_token = api_token;

    fs.writeFile(require('os').homedir() + '/.deployed-config.json', json, err => {
        if (err) {
            global.logger.error(`Cannot save projects to file ~/.deployed-config.json. Error: ${err}`);
        }
      });
}

module.exports = {save_services, save_tunnels, save_config}

