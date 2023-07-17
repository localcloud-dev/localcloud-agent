/*
    tunnel.js
    Methods for tunnel management
*/

const storage = require("../utils/storage");
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 11); //~117 years or 1B IDs needed, in order to have a 1% probability of at least one collision, https://zelark.github.io/nano-id-cc/
const proxy = require("./proxy");

module.exports = function (app) {

    //Add a tunnel
     app.post('/tunnel', async function (req, res) {

        const domain = req.body.domain;
        const name = req.body.name;
        const port = req.body.port;
        const vpn_ip = req.body.vpn_ip;

        //Check if we have a tunnel with the same domain
        //If we have the user should send PUT /service to update the project
        let saved_tunnel = global.tunnels.find(tunnel => tunnel.domain === domain);
        if (saved_tunnel == undefined) {
            var new_tunnel = {};

            new_tunnel.id = nanoid();
            while (global.tunnels.find(tunnel => tunnel.id === new_tunnel.id)) {
                new_tunnel.id = nanoid();
            }

            new_tunnel.domain = domain;
            new_tunnel.name = name;
            new_tunnel.port = port;
            new_tunnel.vpn_ip = vpn_ip;

            global.tunnels.push(new_tunnel);

            storage.save_tunnels();

            //Reload Proxy Server
            //proxy.proxy_reload();

            global.logger.info(`New tunnel added:`);
            global.logger.info(`${JSON.stringify(new_tunnel)}`);

            res.statusCode = 201;
            res.end(JSON.stringify({new_tunnel}));

        } else {
            global.logger.info(`Tunnel with domain: ${domain} already exists. Use another domain.`);

            res.statusCode = 409;
            res.end(JSON.stringify({ "msg": `Tunnel with domain: ${domain} already exists. Use another domain.` }));
        }
    });

    app.get('/tunnel', async function (req, res) {
        res.statusCode = 200;
        res.end(JSON.stringify(global.tunnels));
    });

    app.delete('/tunnel/:tunnel_id', async function (req, res) {

        const tunnel_id = req.params.tunnel_id;

        let index = global.tunnels.find(tunnel => tunnel.id === tunnel_id);
        global.tunnels.splice(index, 1);
        storage.save_tunnels();

        //Reload Proxy Server
        //proxy.proxy_reload();

        global.logger.info(`Tunnel: ${tunnel_id} has been removed`);
        res.statusCode = 200;
        res.end("");

    });

}

