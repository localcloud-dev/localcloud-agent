const fs = require('fs');
const REGEXP_SPECIAL_CHAR =
/[\!\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-]/g;

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

async function get_all_services(){   
    let results = await global.redis_client.ft.search(
        `idx:services`,
        `*`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_service_by_id(service_id){   
    let results = await global.redis_client.ft.search(
        'idx:services',
        `@id: /${service_id}/`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function remove_service_by_id(service_id){   
    await global.redis_client.del(`service:${service_id}`);
}

function simplify_format(documents){
    var services = [];
    if (documents != undefined){
        documents.forEach((service) => {
            services.push(service.value);
        });
    }
    console.log(services);
    return services;
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

module.exports = {save_services, save_tunnels, save_config, add_service, get_all_services, get_service_by_id,remove_service_by_id}

