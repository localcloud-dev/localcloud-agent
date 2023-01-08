/*
    proxy.js
    Methods to manage a proxy server and load balancer
*/

const exec = require('child_process').exec;
const fs = require('fs');
const homedir = require('os').homedir();

function proxy_reload() {
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
    global.services.forEach((service, index) => {
        service.environments.forEach((environment, index) => {
            caddy_file += `
${environment.domain} {
    reverse_proxy * localhost:${environment.exposed_ports[0]}
}
`;
        });
    });

//Fill tunnels
    global.tunnels.forEach((tunnel, index) => {
        caddy_file += `
${tunnel.domain} {
    reverse_proxy * ${tunnel.vpn_ip}:${tunnel.port}
}
`;
    });

    fs.writeFile(`${homedir}/Caddyfile`, caddy_file, err => {
        if (err) {
            global.logger.error(err);
            global.logger.info(`Cannot save a proxy configuration file:`);
            return;
        }

        //Reload Caddyfile
        exec(`cd $HOME && caddy reload`, function (err, stdout, stderr) {
            global.logger.info(`Proxy has been reloaded`);
        });

    });
};

module.exports = { proxy_reload };