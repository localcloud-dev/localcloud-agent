/*
    proxy.js
    Methods to manage a proxy server and load balancer
*/

const exec = require('child_process').exec;
const fs = require('fs');
const homedir = require('os').homedir();
const caddyfile_path = `${homedir}/Caddyfile`;
const storage = require("../utils/storage");

async function create_routes(app) {

    //Add new proxy DB record
    app.post('/proxy', async function (req, res) {

        global.logger.info(`Adding a new Proxy record`);

        const container_id = req.body.container_id;
        const workload_ip = req.body.workload_ip;
        const port = req.body.port;
        const domain = req.body.domain;
        global.logger.info(`container_id:${container_id} workload_ip:${workload_ip} port:${port} domain:${domain}`);

        await storage.update_container_status(container_id, "done");
        await storage.add_proxy(workload_ip, port, domain, container_id );

        res.statusCode = 201;
        res.end(JSON.stringify({}));

    });

}

async function delete_proxy(domain){
    await storage.delete_proxy(domain);
    update_proxy_config();
}

async function proxy_reload() {
    //We update proxy configuration file and reload it in 2 cases
    //- there is no a configuration file yet
    //- there are Proxy records in DB with status == "to_do"
    if (fs.existsSync(caddyfile_path) == false) {
        update_proxy_config();
    } else {
        //Get Proxy records with status == "to_do"
        let proxies = await storage.get_proxies_by_status("to_do");
        if (proxies.length > 0) {
            let proxy = proxies[0];
            await storage.update_proxy_status(proxy.id, "done");
            update_proxy_config();
        }
    }
}

async function update_proxy_config() {
    global.logger.info(`Updating proxy server configuration ...`);

    //1. Fill service-node proxy configuration
    //2. Fill all deployed service configurations
    //3. Fill all tunnel configurations
    //4. Generate a new proxy config file
    //5. Reload a proxy server with a the new proxy server config file

    //Load service node config
    var service_node_config = {};
    service_node_config.domain = global.service_node_config.domain;
    service_node_config.port = global.service_node_config.port;

    //Generate Caddyfile
    var caddy_file = `${service_node_config.domain} {
    reverse_proxy /hey localhost:${service_node_config.port}
    reverse_proxy /deploy/* localhost:${service_node_config.port}
    reverse_proxy /join_vpn/* localhost:${service_node_config.port}
    reverse_proxy * abort
}
`;

    //Fill services
    let proxies = await storage.get_proxies_by_status("done");
    if (proxies.length > 0) {
        proxies.forEach((proxy) => {
            caddy_file += `
${proxy.domain} {
    reverse_proxy * ${proxy.vpn_ip.split('/')[0]}:${proxy.port}
}
`;
        });
    }

    //ToDo: Fill tunnels
    global.tunnels.forEach((tunnel, index) => {
        caddy_file += `
${tunnel.domain} {
    reverse_proxy * ${tunnel.vpn_ip}:${tunnel.port}
}
`;
    });

    fs.writeFile(caddyfile_path, caddy_file, err => {
        if (err) {
            global.logger.error(err);
            global.logger.info(`Cannot save a proxy configuration file:`);
            return;
        }

        //Reload Caddyfile
        exec(`caddy reload`,{cwd: `${homedir}`}, async function (err, stdout, stderr) {
            global.logger.info(`Proxy has been reloaded`);
        });

    });
};

module.exports = { proxy_reload, create_routes, delete_proxy };