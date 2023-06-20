const fs = require('fs');

function save_services(){
    global.redis_client.set('services', JSON.stringify(global.services));
}

async function add_service(service){
    await global.redis_client.hSet(`service:${service.id}`, {
        id: service.id,
        git_url: service.git_url,
        name: service.name,
        full_name: service.full_name,
        environments: JSON.stringify(service.environments)
    })
}


function save_tunnels(){
    global.redis_client.set('tunnels', JSON.stringify(global.tunnels));
}

function save_config(){

    //We should "hide" api_token before saving and "show" it again after saving
    const api_token = global.service_node_config.api_token;
    global.service_node_config.api_token = "";

    //Save VPN nodes to local file
    fs.writeFile(require('os').homedir() + '/.deployed-config.json', JSON.stringify(global.service_node_config), err => {
        if (err) {
            global.logger.error(`Cannot save projects to file ~/.deployed-config.json. Error: ${err}`);
        }
      });

    //Save VPN nodes to DB
    global.redis_client.set('vpn_nodes', JSON.stringify(global.vpn_nodes));

    //Restore API token
    global.service_node_config.api_token = api_token;

}

module.exports = {save_services, save_tunnels, save_config, add_service}

