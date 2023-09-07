/*
    environment.js
    Methods to manage environments
*/

const storage = require("../utils/storage");
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 11); //~117 years or 1B IDs needed, in order to have a 1% probability of at least one collision, https://zelark.github.io/nano-id-cc/
const REGEXP_SPECIAL_CHAR = /[\!\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-\/]/g;

module.exports = function (app) {

    app.post('/environment/:service_id', async function (req, res) {

        let service_id = req.params.service_id;
        var new_environment = req.body;

        let services = await storage.get_service_by_id(service_id);

        if (services.length != 0){
            let service = services[0];
            service.environments.forEach((environment, index) => {
                if (environment.branch == new_environment.branch){
                    global.logger.error(`The environment for the branch ${environment.branch} already exists.`);
                    res.statusCode = 409;
                    res.end(JSON.stringify({ "msg": `The environment for the branch ${environment.branch} already exists.` }));        
                    return;
                }
            })

            new_environment.image_status = 'to_build';
            new_environment.id = nanoid().replace(REGEXP_SPECIAL_CHAR, '\\$&');
            new_environment.service_id = service_id;
            storage.add_environment(new_environment);

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

    app.delete('/environment/:service_id/:environment_name', async function (req, res) {

        let service_id = req.params.service_id;
        let environment_name = req.params.environment_name;

        let services = await storage.get_service_by_id(service_id);
        if (services.length != 0){
            let service = services[0];
            let environment = service.environments.find(environment => environment.name === environment_name);
            if (environment != undefined) {
                //We should plan to remove this environment here
                environment.status = `to_remove`;
                storage.update_environment_status(environment);
                global.logger.info(`Environment: ${environment_name} in the service with id: ${service_id} has been planned for removing`);
                res.statusCode = 200;
                res.end("");  
            }else{
                global.logger.error(`The service with id: ${service_id} hasn't "${environment_name}" environment.`);
                res.statusCode = 404;
                res.end(JSON.stringify({ "msg": `Cannot find "${environment_name}" environment in a service with id: ${service_id}.` })); 
            }
        }else{
            global.logger.error(`Cannot find a service with id: ${service_id}.`);
            res.statusCode = 404;
            res.end(JSON.stringify({ "msg": `Cannot find a service with id: ${service_id}.` }));        
        }

    });

}

