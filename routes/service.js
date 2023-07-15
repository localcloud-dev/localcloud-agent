/*
    service.js
    Methods for service management
*/

const path = require('path');
const storage = require("../utils/storage");
const { customAlphabet } = require("nanoid");
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 11); //~117 years or 1B IDs needed, in order to have a 1% probability of at least one collision, https://zelark.github.io/nano-id-cc/
const REGEXP_SPECIAL_CHAR = /[\!\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-\/]/g;

module.exports = function (app) {

    //Add a service and deploy from Bitbucket or GitHub
    //Note: before calling this endpoint you should add public ssh key of a server where you want to deploy to Bitbucket, GitLab, GitHub access keys
    //and add webhook to your Bitbucket, GitHub repository. Hints about how to do this are shown when you run "deploy"
    app.post('/service', async function (req, res) {
        const git_url = req.body.git_url;
        const environments = req.body.environments;
        const repository_name = path.parse(git_url.substring(git_url.lastIndexOf('/') + 1)).name;

        var git_base_url = "bitbucket.org";
        var index = git_url.indexOf(git_base_url);

        if (index == -1){
            //Check if Git URL includes GitHub
            git_base_url = "github.com";
            index = git_url.indexOf(git_base_url);
        }

        if (index == -1){
            //Deployed.cc doesn't support this Git server
            global.logger.error(`Git repository on: ${git_url} isn't supported yet.`);

            res.statusCode = 409;
            res.end(JSON.stringify({ "msg": `Git repository on: ${git_url} isn't supported yet. Request support this git provider by contacting us.` }));

        }

        const repository_workspace = git_url.substring(index + 1 + git_base_url.length, git_url.lastIndexOf('/'));
        const repository_full_name = `${repository_workspace}/${repository_name}`;

        //Check if we have a service with this name
        //If we have the user should send PUT /service to update the project
        //let saved_service = global.services.find(project => project.git_url === git_url);
        
        let result = await global.redis_client.ft.search(
            'idx:services',
            `@name: {${repository_name.replace(REGEXP_SPECIAL_CHAR, '\\$&')}}`
        );
        
        console.log(JSON.stringify(result, null, 2));
        
        if (result.total == 0) {
            var new_service = {};

            new_service.id = nanoid();
            new_service.id = new_service.id.replace(REGEXP_SPECIAL_CHAR, '\\$&');

            var id_search_result = await global.redis_client.ft.search(
                'idx:services',
                `@id: /${new_service.id}/`
            );
            console.log(JSON.stringify(result, null, 2));
            
            while (id_search_result.total != 0) {
                new_service.id = nanoid();
                id_search_result = await global.redis_client.ft.search(
                    'idx:services',
                    `@id:${new_service.id}`
                );
                console.log(JSON.stringify(result, null, 2));
            }

            new_service.name = repository_name;
            new_service.full_name = repository_full_name;

            environments.forEach((environment, index) => {
                environment.image_status = 'to_build';
            })

            new_service.environments = environments;
            new_service.git_url = git_url;

            storage.add_service(new_service);

            global.logger.info(`New service added:`);
            global.logger.info(`${JSON.stringify(new_service)}`);

            res.statusCode = 201;
            res.end(JSON.stringify({}));

        } else {
            global.logger.info(`Project with name: ${repository_name} already exists. Use PUT /service to update a project.`);

            res.statusCode = 409;
            res.end(JSON.stringify({ "msg": `Project with git url: ${git_url} already exists. Use PUT /service to update a project.` }));
        }
    });

    app.get('/service', async function (req, res) {
        //Load services from DB and simplify the output format
        let services = await storage.get_services();
        res.statusCode = 200;
        res.end(JSON.stringify(services));
    });

    app.get('/service/:service_id', async function (req, res) {
        //Search a service with :service_id in DB and simplify the output format
        let service_id = req.params.service_id;
        let services = await storage.get_service_by_id(service_id);

        if (services.length == 0){
            res.statusCode = 404;
            res.end(JSON.stringify({ "msg": `Service with id: ${service_id} not found.` }));
        }else{
            res.statusCode = 200;
            res.end(JSON.stringify(services[0]));
        }
    });

    app.delete('/service/:service_id', async function (req, res) {

        let service_id = req.params.service_id;
        let services = await storage.get_service_by_id(service_id);
        
        if (services.length == 0){
            res.statusCode = 404;
            res.end(JSON.stringify({ "msg": `Service with id: ${service_id} not found.` }));
        }else{
            await storage.remove_service_by_id(service_id);
            res.statusCode = 200;
            res.end();
        }

        //We should check that there are no any environments in this service
        //Now we can remove only a service without environments
        /*let service = global.services.find(service => service.id === service_id);
        if (service != undefined) {
            if (service.environments.length != 0) {
                res.statusCode = 403;
                res.end(JSON.stringify({ "msg": `Cannot remove a service ${service.name} because it has environments. Remove all service's environments at first and then try again.` }));
                return;
            }
        }

        let index = global.services.find(service => service.id === service_id);
        global.services.splice(index, 1);
        storage.save_services();

        global.logger.info(`Service: ${service_id} has been removed`);
        res.statusCode = 200;
        res.end("");*/

    });

}

