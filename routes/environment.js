/*
    environment.js
    Methods to manage environments
*/

const storage = require("../utils/storage");
const auth = require("../utils/auth");

module.exports = function (app) {

    app.post('/environment/:service_id', async function (req, res) {

        const api_token = await auth.validate_token(req.headers["api-token"]);
        if (api_token == false) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Invalid api token" }));
            return;
        }

        const service_id = req.params.service_id;
        var new_environment = req.body;
        let saved_service = global.projects.find(service => service.id === service_id);
        if (saved_service != undefined) {
            saved_service.environments.forEach((environment, index) => {
                if (environment.branch == new_environment.branch){
                    global.logger.error(`The environment for the branch ${environment.branch} already exists.`);
                    res.statusCode = 409;
                    res.end(JSON.stringify({ "msg": `The environment for the branch ${environment.branch} already exists.` }));        
                    return;
                }
            })

            new_environment.status = `to_deploy`;
            saved_service.environments.push(new_environment);

            storage.save_services();

            global.logger.info(`New environment added:`);
            global.logger.info(`${JSON.stringify(new_environment)}`);

            res.statusCode = 201;
            res.end(JSON.stringify({}));

        }else{
            global.logger.error(`Cannot find a service with id: ${service_id}.`);
            res.statusCode = 404;
            res.end(JSON.stringify({ "msg": `Cannot find a service with id: ${service_id}.` }));        
        }

    });
}

