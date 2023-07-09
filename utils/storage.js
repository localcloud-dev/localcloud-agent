const fs = require('fs');
const REGEXP_SPECIAL_CHAR =
/[\!\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-]/g;

//ToDo: replace with update_service(service_id)
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

async function get_services(){   
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

function save_tunnels(){
    global.redis_client.set('tunnels', JSON.stringify(global.tunnels));
}

async function add_vpn_node(vpn_node){
    await global.redis_client.hSet(`vpnnode:${vpn_node.id}`, {
        id: vpn_node.id,
        ip: vpn_node.ip,
        name: vpn_node.name,
        type: JSON.stringify(vpn_node.type)
    })
}

async function get_vpn_nodes(){
    let results = await global.redis_client.ft.search(
        `idx:vpnnodes`,
        `*`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_vpn_node_by_id(node_id){   
    let results = await global.redis_client.ft.search(
        'idx:vpnnodes',
        `@id: /${node_id}/`
    );

    //Simplify the output format
    return simplify_format(results.documents);
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
    //global.redis_client.set('vpn_nodes', JSON.stringify(global.vpn_nodes));

    //Restore API token
    global.service_node_config.api_token = api_token;

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

module.exports = {save_services, save_tunnels, save_config, add_service, get_services, get_service_by_id,remove_service_by_id, add_vpn_node, get_vpn_nodes, get_vpn_node_by_id}

