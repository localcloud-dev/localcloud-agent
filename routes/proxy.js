/*
    proxy.js
    Methods to manage a proxy server and load balancer
*/

const exec = require('child_process').exec;
const fs = require('fs');
const homedir = require('os').homedir();

function proxy_reload() {
    global.logger.info(`Handling /proxy/reload/ ...`);

    //1. Load service-node configuration
    //2. Load all deployed project configurations
    //3. Generate a new proxy config file
    //4. Reload a proxy server

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

    global.projects.forEach((service, index) => {
        service.environments.forEach((environment, index) => {
            caddy_file += `
${environment.domain} {
    reverse_proxy * localhost:${environment.exposed_ports[0]}
}
`;
        });
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