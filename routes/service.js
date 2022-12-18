/*
    service.js
    Methods for project deployment
*/

const path = require('path');
const storage = require("../utils/storage");

module.exports = function (app) {

    //Add a service and deploy from Bitbucket, GitHub or GitLab
    //Note: before calling this endpoint you should add public ssh key of a server where you want to deploy to Bitbucket, GitLab, GitHub access keys
    //and add webhook to your Bitbucket, GitLab, GitHub repository. Hints about how to do this are shown when you run "deploy"
    app.post('/service/:api_key', async function (req, res) {

        if (req.params.api_key != '111') {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Invalid api key" }));
            return;
        }

        const git_url = req.body.git_url;
        const branch = req.body.branch;
        const domain = req.body.domain;
        const service_port = req.body.port;

        const repository_name = path.parse(git_url.substring(git_url.lastIndexOf('/') + 1)).name; 

        const bitbucket_base_url = "bitbucket.org";
        const index = git_url.indexOf(bitbucket_base_url);

        const repository_workspace = git_url.substring(index + 1 + bitbucket_base_url.length, git_url.lastIndexOf('/')); 
        const repository_full_name = `${repository_workspace}/${repository_name}`;

        //Check if we have a project with this git url
        //If we have the user should send PUT /service to update the project
        let saved_project = global.projects.find(project => project.git_url === git_url);
        if (saved_project == undefined){
            var new_project = {};
            new_project.name = repository_name;
            new_project.full_name = repository_full_name;
                
                var environment = {};
                environment.service_port = service_port;

                environment.branch = branch;
                environment.name = branch;
                environment.domain = domain;
                environment.status = "to_deploy";

                new_project.environments = [environment];

                new_project.git_url = git_url;
    
                global.projects.push(new_project);
    
                storage.save_projects();

                global.logger.info(`New project added:`);
                global.logger.info(`${JSON.stringify(new_project)}`);

                res.statusCode = 201;
                res.end(JSON.stringify({}));

        }else{
            global.logger.info(`Project with git url: ${git_url} already exists. Use PUT /service to update a project.`);

            res.statusCode = 409;
            res.end(JSON.stringify({"msg":`Project with git url: ${git_url} already exists. Use PUT /service to update a project.`}));
        }
    });

}

