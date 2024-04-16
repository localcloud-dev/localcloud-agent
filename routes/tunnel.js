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
        //let saved_tunnel = global.tunnels.find(tunnel => tunnel.domain === domain);
        let saved_tunnel = await storage.get_tunnel_by_domain(domain);
        if (saved_tunnel.length == 0) {
            var new_tunnel = {};

            new_tunnel.id = nanoid();
            var tunnels_with_same_id = await storage.get_tunnel_by_id(new_tunnel.id);
            while (tunnels_with_same_id.length > 0) {
                new_tunnel.id = nanoid();
                tunnels_with_same_id = await storage.get_tunnel_by_id(new_tunnel.id);
            }

            new_tunnel.domain = domain;
            new_tunnel.name = name;
            new_tunnel.port = port;
            new_tunnel.vpn_ip = vpn_ip;

            await storage.add_tunnel(new_tunnel);

            //Reload Proxy Server
            await storage.add_proxy(vpn_ip, port, domain, "" );

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
        let tunnels = await storage.get_tunnels();
        res.statusCode = 200;
        res.end(JSON.stringify(tunnels));
    });

    app.delete('/tunnel/:tunnel_id', async function (req, res) {

        const tunnel_id = req.params.tunnel_id;
        let tunnels = await storage.get_tunnel_by_id(tunnel_id);
        if (tunnels.length > 0){
            await storage.delete_tunnel(tunnel_id);

            //Reload Proxy Server
            await storage.delete_proxy(tunnels[0].domain);
        }

        global.logger.info(`Tunnel: ${tunnel_id} has been removed`);
        res.statusCode = 200;
        res.end("");

    });

}

