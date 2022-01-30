/*
    environment.js
    Methods for managing environments
*/
const dotenv = require('dotenv');
dotenv.config();

const os = require('os');
const home_dir = `${os.homedir()}/`;

const superagent = require('superagent');
const portastic = require('portastic');

const Parse = require('parse/node');
const ParseAppId = process.env.PARSE_APP_ID;
Parse.initialize(ParseAppId);
Parse.serverURL = process.env.PARSE_SERVER_URL;

//Load API key
const fs = require('fs');

const Auth = require("./auth");
const auth = new Auth();

module.exports = function (app) {

    app.post('/environment', async function (req, res) {
        console.log(`/POST /environment, body: ${JSON.stringify(req.body)}`);
        const logged_user = await auth.handleAllReqs(req, res);
        if (logged_user == null) {
            return;
        }

        //Get project created in /checking_git request
        var new_project = {};
        try {
            const get_res = await superagent.get(Parse.serverURL + '/classes/Project/' + req.body.project_id).send({}).set({ 'X-Parse-Application-Id': ParseAppId, 'X-Parse-Session-Token': req.headers['authorization'] }).set('accept', 'json');

            if (get_res.statusCode != 200) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Invalid token, cannot get project with id: ' + req.body.project_id }));
                return;
            } else {
                new_project = get_res.body;
                new_project.project_id = req.body.project_id;

            }
        } catch (err) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: err }));
        }

        //Find a project with the same id from deployed projects
        var saved_project = {};
        global.projects.forEach((project) => {
            if (project.project_id == new_project.project_id) {
                saved_project = project;
            }
        });

        //Check if we should add new environments or update already existed
        var env_index = 0;
        var is_should_wait_for_new_port = false;

        new_project.environments.forEach((new_project_env) => {
            var is_env_already_exist = false;
            saved_project.environments.forEach((saved_project_env) => {
                if (new_project_env.name == saved_project_env.name) {
                    is_env_already_exist = true;

                    //Replace old project with updated
                    var pos = global.projects.map(function (x) { return x.project_id; }).indexOf(new_project.project_id);
                    global.projects.splice(pos, 1, new_project);
                    fs.writeFileSync(home_dir + '/.deployed/projects.json', JSON.stringify(global.projects));

                    /*if (new_project_env.branch != saved_project_env.branch){
                      //Update this environment and add a new job to query
                      addJobToQuery(new_project, new_project_env);
                    }*/
                }
            });

            if (is_env_already_exist == false) {
                const env_index_to_add_port = env_index;
                is_should_wait_for_new_port = true;
                //Add new environment to deployment query
                portastic.find({
                    min: 4000,
                    max: 8000
                })
                    .then(async function (ports) {
                        const next_available_port = ports[global.projects_to_deploy.length];
                        console.log(`${next_available_port} ${new_project.environments.length}  ${env_index_to_add_port}`);
                        new_project.environments[env_index_to_add_port].cluster_port = next_available_port;
                        addJobToQuery(new_project, new_project_env, next_available_port);

                        //Replace old project with updated
                        var pos = global.projects.map(function (x) { return x.project_id; }).indexOf(new_project.project_id);
                        global.projects.splice(pos, 1, new_project);
                        fs.writeFileSync(home_dir + '/.deployed/projects.json', JSON.stringify(global.projects));

                        //Set new port to Parse Server Project object
                        try {
                            var project_update = {};
                            project_update.environments = new_project.environments;
                            const put_res = await superagent.put(Parse.serverURL + '/classes/Project/' + new_project.project_id).send(project_update).set({ 'X-Parse-Application-Id': ParseAppId, 'X-Parse-Session-Token': req.headers['authorization'] }).set('accept', 'json');
                            if (put_res.statusCode != 200) {
                                res.statusCode = 401;
                                res.end(JSON.stringify({ message: "Unable to authenticate you.", id: "unauthorized" }));
                                return;
                            } else {
                                res.statusCode = 200;
                                res.end(JSON.stringify({}));
                            }
                        } catch (err) {
                            res.statusCode = 401;
                            res.end(JSON.stringify({ message: "Unable to authenticate you.", id: "unauthorized", add_info: err }));
                            return;
                        }
                    });
            }
            env_index += 1;
        });
        if (is_should_wait_for_new_port == false) {
            res.statusCode = 200;
            res.end(JSON.stringify({}));
        }
    });

    function addJobToQuery(new_project, environment, port) {
        var project_to_add_to_query = {};
        project_to_add_to_query.project_id = new_project.project_id;
        project_to_add_to_query.git_url = new_project.git_url;
        project_to_add_to_query.environment = environment.name;
        project_to_add_to_query.branch = environment.branch;
        project_to_add_to_query.project_name = new_project.name;
        project_to_add_to_query.cluster_port = port;
        project_to_add_to_query.project_port = new_project.port;
        project_to_add_to_query.dockerfile = new_project.dockerfile;
        project_to_add_to_query.docker_run_cmd = new_project.docker_run_cmd;
      
        global.projects_to_deploy.push(project_to_add_to_query);
      
        //Add environment domains to query
        environment.domains.forEach((domain) => {
          var domain_to_add_to_query = {};
          domain_to_add_to_query.port = port;
          domain_to_add_to_query.domain = domain;
          //Check if it's main domain (project_id.process.env.DOMAIN) or custom domain
          if (domain == environment.domains[0]) {
            domain_to_add_to_query.target = `${new_project.clusters[0].toLowerCase()}.${process.env.DOMAIN}`;
          } else {
            domain_to_add_to_query.target = environment.domains[0];
          }
          domain_to_add_to_query.project_id = new_project.project_id;
          global.domains_to_add.push(domain_to_add_to_query);
        });
      }

}
