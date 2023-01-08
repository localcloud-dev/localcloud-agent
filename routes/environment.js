/*
    environment.js
    Methods to manage environments
*/

const storage = require("../utils/storage");

module.exports = function (app) {

    app.post('/environment/:service_id', async function (req, res) {

        const service_id = req.params.service_id;
        var new_environment = req.body;
        let saved_service = global.services.find(service => service.id === service_id);
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

    app.delete('/environment/:service_id/:environment_name', async function (req, res) {

        const service_id = req.params.service_id;
        const environment_name = req.params.environment_name;

        let service = global.services.find(service => service.id === service_id);
        if (service != undefined) {

            let environment = service.environments.find(environment => environment.name === environment_name);
            if (environment != undefined) {
                //We should just plan for removing here
                environment.status = `to_remove`;
                storage.save_services();
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

