/*
    service.js
    Methods for project deployment
*/

const path = require('path');
const storage = require("../utils/storage");
const auth = require("../utils/auth");
const { nanoid } = require("nanoid");

module.exports = function (app) {

    //Add a service and deploy from Bitbucket, GitHub or GitLab
    //Note: before calling this endpoint you should add public ssh key of a server where you want to deploy to Bitbucket, GitLab, GitHub access keys
    //and add webhook to your Bitbucket, GitLab, GitHub repository. Hints about how to do this are shown when you run "deploy"
    app.post('/service', async function (req, res) {

        const git_url = req.body.git_url;
        const environments = req.body.environments;
        const repository_name = path.parse(git_url.substring(git_url.lastIndexOf('/') + 1)).name;

        const bitbucket_base_url = "bitbucket.org";
        const index = git_url.indexOf(bitbucket_base_url);

        const repository_workspace = git_url.substring(index + 1 + bitbucket_base_url.length, git_url.lastIndexOf('/'));
        const repository_full_name = `${repository_workspace}/${repository_name}`;

        //Check if we have a service with this git url
        //If we have the user should send PUT /service to update the project
        let saved_service = global.projects.find(project => project.git_url === git_url);
        if (saved_service == undefined) {
            var new_service = {};

            new_service.id = nanoid(10);
            while (global.projects.find(service => service.id === new_service.id)) {
                new_service.id = nanoid(10);
            }

            new_service.name = repository_name;
            new_service.full_name = repository_full_name;

            environments.forEach((environment, index) => {
                environment.status = "to_deploy";
            })

            new_service.environments = environments;
            new_service.git_url = git_url;
            global.projects.push(new_service);

            storage.save_services();

            global.logger.info(`New project added:`);
            global.logger.info(`${JSON.stringify(new_service)}`);

            res.statusCode = 201;
            res.end(JSON.stringify({}));

        } else {
            global.logger.info(`Project with git url: ${git_url} already exists. Use PUT /service to update a project.`);

            res.statusCode = 409;
            res.end(JSON.stringify({ "msg": `Project with git url: ${git_url} already exists. Use PUT /service to update a project.` }));
        }
    });

    app.get('/service', async function (req, res) {
        res.statusCode = 200;
        res.end(JSON.stringify(global.projects));
    });


    app.get('/service/:service_id/environment', async function (req, res) {

        const service_id = req.params.service_id;

        let service = global.projects.find(service => service.id === service_id);
        if (service != undefined) {

            res.statusCode = 200;
            res.end(JSON.stringify(service.environments));

        } else {
            res.statusCode = 403;
            res.end(JSON.stringify({ msg: "Service not found" }));
        }

    });

    app.delete('/service/:service_id', async function (req, res) {

        const service_id = req.params.service_id;

        //We should check that there are no any environments in this service
        //Now we can remove only a service without environments
        let service = global.projects.find(service => service.id === service_id);
        if (service != undefined) {
            if (service.environments.length != 0) {
                res.statusCode = 403;
                res.end(JSON.stringify({ "msg": `Cannot remove a service ${service.name} because it has environments. Remove all service's environments at first and then try again.` }));
                return;
            }
        }

        let index = global.projects.find(service => service.id === service_id);
        global.projects.splice(index, 1);
        storage.save_services();

        global.logger.info(`Service: ${service_id} has been removed`);
        res.statusCode = 200;
        res.end("");

    });

}

