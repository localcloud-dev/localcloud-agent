const fs = require('fs');
const REGEXP_SPECIAL_CHAR =
/[\!\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-\/]/g;

const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 13); //~211 years or 1B IDs needed, in order to have a 1% probability of at least one collision, https://zelark.github.io/nano-id-cc/

async function add_service(service){
    await global.redis_client.hSet(`service:${service.id}`, {
        id: service.id,
        git_url: service.git_url,
        name: service.name,
        full_name: service.full_name,
        created_at: Math.round(Date.now() / 1000)
    })
}

async function get_services(){   
    let results = await global.redis_client.ft.search(
        `idx:services`,
        `*`
    );

    //Simplify the output format
    var services = simplify_format(results.documents);
    for (var i = 0; i< services.length; i += 1){
        var service = services[i];
        service.environments = await get_environments_by_service_id(service.id);
    }

    return services;

}

async function get_service_by_id(service_id){   
    let results = await global.redis_client.ft.search(
        'idx:services',
        `@id: /${service_id}/`
    );

    var services = simplify_format(results.documents);
    for (var i = 0; i< services.length; i += 1){
        var service = services[i];
        service.environments = await get_environments_by_service_id(service.id);
    }

    //Simplify the output format
    return services;
}

async function get_service_by_fullname(full_name){   
    let results = await global.redis_client.ft.search(
        'idx:services',
        `@full_name: {${full_name.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    return simplify_format(results.documents);
}

async function remove_service_by_id(service_id){   
    await global.redis_client.del(`service:${service_id}`);
}

//Environments
async function add_environment(environment){
    await global.redis_client.hSet(`environment:${environment.id}`, {
        id: environment.id,
        name:environment.name,
        branch:environment.branch,
        domains:JSON.stringify(environment.domains),
        port:environment.port,
        image_status:environment.image_status,
        service_id:environment.service_id,
        servers:JSON.stringify(environment.servers),
        created_at: Math.round(Date.now() / 1000)
    })
}

async function update_environment_status(environment_id, status){
    await global.redis_client.hSet(`environment:${environment_id}`, {
        status: status
    })
}

async function delete_environment_by_id(environment_id){
    await global.redis_client.del(`environment:${environment_id}`);
}

async function get_environment_by_branch(service_id, branch){   
    let results = await global.redis_client.ft.search(
        'idx:environments',
        `@branch: {${branch.replace(REGEXP_SPECIAL_CHAR, '\\$&')}} @service_id: /${service_id}/`
    );

    //Simplify the output format
    const environments = simplify_format(results.documents);
    if (environments.length > 0){
        let environment = environments[0];
        environment.domains = JSON.parse(environment.domains);
        environment.servers = JSON.parse(environment.servers);
        return environment;
    }

    return null;
}

async function get_environments_by_service_id(service_id){   
    let results = await global.redis_client.ft.search(
        'idx:environments',
        `@service_id: /${service_id}/`
    );

    const environments = simplify_format(results.documents);

    for (var i = 0; i< environments.length; i += 1){
        environments[i].domains = JSON.parse(environments[i].domains);
        environments[i].servers = JSON.parse(environments[i].servers);
    }

    return environments;
}

async function get_environment_by_id(environment_id){   
    let results = await global.redis_client.ft.search(
        'idx:environments',
        `@id: /${environment_id}/`
    );

    const environments = simplify_format(results.documents);
    if (environments.length > 0){
        let environment = environments[0];
        environments[0].domains = JSON.parse(environment.domains);
        environments[0].servers = JSON.parse(environment.servers);
        return environments[0];
    }
    return null;
}

//Tunnels
function save_tunnels(){
    global.redis_client.set('tunnels', JSON.stringify(global.tunnels));
}

async function add_tunnel(tunnel){
    await global.redis_client.hSet(`tunnel:${tunnel.id}`, {
        id: tunnel.id,
        vpn_ip: tunnel.vpn_ip,
        name: tunnel.name,
        port: tunnel.port,
        domain: tunnel.domain,
        created_at: Math.round(Date.now() / 1000)
    })
}

async function get_tunnel_by_domain(tunnel_domain){   
    let results = await global.redis_client.ft.search(
        'idx:tunnels',
        `@domain: /${tunnel_domain}/`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_tunnel_by_id(tunnel_id){   
    let results = await global.redis_client.ft.search(
        'idx:tunnels',
        `@id: /${tunnel_id}/`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_tunnels(){   
    let results = await global.redis_client.ft.search(
        'idx:tunnels',
        `*`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function delete_tunnel(tunnel_id){   
    await global.redis_client.del(`tunnel:${tunnel_id}`);
}


//VPN nodes
async function add_vpn_node(vpn_node){
    await global.redis_client.hSet(`vpnnode:${vpn_node.id}`, {
        id: vpn_node.id,
        ip: vpn_node.ip,
        status: vpn_node.status,
        public_ip: vpn_node.public_ip,
        name: vpn_node.name,
        type: JSON.stringify(vpn_node.type),
        created_at: Math.round(Date.now() / 1000)
    })
}

async function update_vpn_node_status(vpn_node_id, status){
    await global.redis_client.hSet(`vpnnode:${vpn_node_id}`, {
        status: status
    })
}

async function update_vpn_node_public_ip(vpn_node_id, public_ip){
    await global.redis_client.hSet(`vpnnode:${vpn_node_id}`, {
        public_ip: public_ip
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


async function delete_vpn_node(node_id){
    let nodes = await get_vpn_node_by_id(node_id);
    if (nodes != null && nodes.length > 0){
        await global.redis_client.del(`vpnnode:${nodes[0].id}`);
        return true;
    }
    return false;

}

//Image Records

async function create_image_and_containers(service, environment){
    console.log(`Create a new image record in DB`);
    let image_id = await add_image(service, environment);
    environment.servers.forEach(async (server) => {
        console.log(`Create a new container record in DB`);
        await add_container(image_id, server.id, environment.id)
    });
}

async function add_image(service, environment){
    let image_id = nanoid();
    await global.redis_client.hSet(`image:${image_id}`, {
        id: image_id,
        service_id: service.id,
        environment_id: environment.id,
        git_url: service.git_url,
        status: "to_do",
        created_at: Math.round(Date.now() / 1000)
    })
    return image_id;
}

async function get_images(){
    let results = await global.redis_client.ft.search(
        `idx:images`,
        `*`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_image_by_id(image_id){   
    let results = await global.redis_client.ft.search(
        'idx:images',
        `@id: /${image_id}/`
    );
    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_images_by_environment_id(environment_id){
    let results = await global.redis_client.ft.search(
        'idx:images',
        `@environment_id: {${environment_id.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_images_by_status(status){
    let results = await global.redis_client.ft.search(
        'idx:images',
        `@status: {${status.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    return simplify_format(results.documents);
}

async function update_image_status(image_id, status){
    await global.redis_client.hSet(`image:${image_id}`, {
        status: status
    })
}

//Container Records
async function add_container(image_id, target_server_id, environment_id){
    let container_id = nanoid();
    await global.redis_client.hSet(`container:${container_id}`, {
        id: container_id,
        image_id: image_id,
        target: target_server_id,
        environment_id: environment_id,
        status: "to_do",
        created_at: Math.round(Date.now() / 1000)
    })
}

async function get_containers(){
    let results = await global.redis_client.ft.search(
        `idx:containers`,
        `*`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_containers_by_status(status){
    let results = await global.redis_client.ft.search(
        'idx:containers',
        `@status: {${status.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_containers_by_status_and_target_id(status, target_id){
    let results = await global.redis_client.ft.search(
        'idx:containers',
        `@status: {${status.replace(REGEXP_SPECIAL_CHAR, '\\$&')}} @target: {${target_id.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_containers_by_environment_id(environment_id){
    let results = await global.redis_client.ft.search(
        'idx:containers',
        `@environment_id: {${environment_id.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    return simplify_format(results.documents);
}

async function update_container_status(container_id, status){
    await global.redis_client.hSet(`container:${container_id}`, {
        status: status
    })
}

//Proxy Records
async function add_proxy(vpn_ip, port, domain, container_id){
    //Remove an old proxy with the same domain
    let old_proxy = await get_proxy_by_domain(domain);
    if (old_proxy != null){
        await global.redis_client.del(`proxy:${old_proxy.id}`);
    }

    //Add a new proxy
    let proxy_id = nanoid();
    await global.redis_client.hSet(`proxy:${proxy_id}`, {
        id: proxy_id,
        container_id: container_id,
        vpn_ip: vpn_ip,
        port: port,
        domain: domain,
        status: "to_do",
        created_at: Math.round(Date.now() / 1000)
    })
}

async function delete_proxy(domain){
    let proxy_to_delete = await get_proxy_by_domain(domain);
    if (proxy_to_delete != null){
        await global.redis_client.del(`proxy:${proxy_to_delete.id}`);
    }
}

async function get_proxies(){
    let results = await global.redis_client.ft.search(
        `idx:proxies`,
        `*`
    );

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_proxies_by_status(status){
    let results = await global.redis_client.ft.search(
        'idx:proxies',
        `@status: {${status.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    return simplify_format(results.documents);
}

async function get_proxy_by_domain(domain){
    let results = await global.redis_client.ft.search(
        'idx:proxies',
        `@domain: {${domain.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
    ); 

    //Simplify the output format
    let proxies = simplify_format(results.documents);
    if (proxies.length > 0){
        return proxies[0];
    }
    return null;
}

async function update_proxy_status(proxy_id, status){
    await global.redis_client.hSet(`proxy:${proxy_id}`, {
        status: status
    })
}

//Others
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

        //Sort by created_at in DESC
        services.sort(function(a,b){
            // Turn your strings into dates, and then subtract them
            // to get a value that is either negative, positive, or zero.
            return b.created_at - a.created_at;
        });
    }
    console.log(services);
    return services;
}

module.exports = {add_proxy, delete_proxy, get_proxies, get_proxies_by_status, update_proxy_status, create_image_and_containers, add_container, get_containers, get_containers_by_status, get_containers_by_status_and_target_id, update_container_status, add_environment, delete_environment_by_id, update_environment_status, get_environment_by_branch, get_environments_by_service_id, get_environment_by_id, get_containers_by_environment_id, save_tunnels, save_config, add_service, get_services, get_service_by_id, get_service_by_fullname, remove_service_by_id, add_vpn_node, update_vpn_node_status, update_vpn_node_public_ip, get_vpn_nodes, get_vpn_node_by_id, delete_vpn_node, add_image, get_image_by_id, get_images, get_images_by_status, get_images_by_environment_id, update_image_status, add_tunnel, get_tunnel_by_domain, get_tunnel_by_id, get_tunnels, delete_tunnel}
