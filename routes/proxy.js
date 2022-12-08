/*
    proxy.js
    Methods to manage a proxy server and load balancer
*/

const exec = require('child_process').exec;
const fs = require('fs');
const homedir = require('os').homedir();

function proxy_reload (){
        global.logger.info(`Handling /proxy/reload/ ...`);

        //1. Load service-node configuration
        //2. Load all deployed project configurations
        //3. Generate a new proxy config file
        //4. Reload a proxy server

        //Load service node config
        var service_node_config = {};
        service_node_config.domain = global.service_node_config.domain;
        service_node_config.port = global.service_node_config.port;

        //Load projects
        var projects = [];

        //Generate Caddyfile
        var caddy_file = `${service_node_config.domain} {
    reverse_proxy * localhost:${service_node_config.port}
}
`;

        projects.forEach((project, index) => {
            caddy_file += `${project.domain} {
    reverse_proxy * localhost:${service_node_config.port}
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

    module.exports = {proxy_reload};