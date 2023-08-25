/*
    deploy.js
    Methods for project deployment
*/

const storage = require("../utils/storage");
const auth = require("../utils/auth");
const fs = require('fs');
const home_dir = `${require('os').homedir()}`;

module.exports = function (app) {

    //Handles Webhooks from Git repository
    //Now only Bitbucket repositories are supported
    app.post('/deploy/:api_token', async function (req, res) {

        //Git services doesn't send any custom headers that's why we can use only api_token in URL and add it to headers here
        req.headers["api-token"]= req.params.api_token;
        if (await auth.validate_token(req.headers) == false){
            res.statusCode = 401;
            res.end(JSON.stringify({ error: "Invalid api key" }));
            return;
        }

        //Check headers to find the source of a webhook
        if (req.headers["x-hook-uuid"] != undefined){
            //Bitbucket webhook
            handle_bitbucket(req, res);
            return;
        }else if (req.headers["x-github-delivery"] != undefined){
            //GitHub webhook
            handle_github(req, res);
            return;
        }else{
            //Unknown source
            res.statusCode = 403;
            res.end("");
            return;
        }

    });

    app.get('/deploy/credentials', async function (req, res) {
        const ssh_pub_key = fs.readFileSync(home_dir + '/.ssh/id_rsa.pub', 'utf8');
        const credentials = {"ssh_pub_key":ssh_pub_key,"webhook_url":`https://${global.service_node_config.domain}/deploy/${global.service_node_config.api_token}`}
        res.statusCode = 200;
        res.end(JSON.stringify(credentials));
    });

    async function handle_bitbucket(req, res){
        if (req.body.repository == undefined) {
            res.statusCode = 403;
            res.end("");
            return;
        }

        const repo_name = req.body.repository.name;
        const repo_full_name = req.body.repository.full_name;
        const updated_branch = req.body.push.changes[0].new.name;

        console.log(repo_name + " " + updated_branch);

        //Update projects
        //let service = global.services.find(service => service.full_name === repo_full_name);
        console.log(`Searching for a service with full name: ${repo_full_name}`)
        let services = await storage.get_service_by_fullname(repo_full_name);
        if (services != undefined && services.length == 1) {
            let service = services[0];
            console.log(`Found service: ${JSON.stringify(service)}`);
            var environment = JSON.parse(service.environments).find(environment => environment.branch === updated_branch);
            storage.create_image_and_containers(service, environment);
        }
        res.statusCode = 200;
        res.end(JSON.stringify({}));
    }

    function handle_github(req, res){

        if (req.body.repository == undefined) {
            res.statusCode = 403;
            res.end("");
            return;
        }

        const repo_name = req.body.repository.name;
        const repo_full_name = req.body.repository.full_name;
        const ref = req.body.ref;
        var updated_branch;
        if (ref.indexOf("refs/heads/") != undefined){
            updated_branch = req.body.ref.replace("refs/heads/","");
        }

        if (updated_branch == undefined) {
            res.statusCode = 403;
            res.end("");
            return;
        }

        console.log(repo_name + " " + updated_branch);

        //Update projects
        let service = global.services.find(service => service.full_name === repo_full_name);
        if (service != undefined) {
            var environment = service.environments.find(environment => environment.branch === updated_branch);
            if (environment != undefined) {
                environment.status = "to_deploy";
                //storage.save_services();
            }
        }

        res.statusCode = 200;
        res.end(JSON.stringify({}));

    }

}
