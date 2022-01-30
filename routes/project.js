/*
    environment.js
    Methods for managing projects
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

const fs = require('fs');

const Auth = require("./auth");
const auth = new Auth();

module.exports = function (app) {

    app.post('/project', async function (req, res) {
        const logged_user = await auth.handleAllReqs(req, res);
      
        if (logged_user == null) {
          return;
        }
      
        //ToDo Move this check in check_git in dep_cluster
        //Check if a project with the same git url is added already
        /*  global.projects.forEach((project) => {
            if (project.git_url == req.body.git_url){
              console.log(req.body);
              res.statusCode = 500;
              res.end(JSON.stringify({error:"Project is added already"}));
              return;
            }
          });*/
      
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
            global.projects.push(new_project);
          }
        } catch (err) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: err }));
        }
      
        //Update projects file with cluster's projects
        fs.writeFileSync(home_dir + '/.deployed/projects.json', JSON.stringify(global.projects));
      
        portastic.find({
          min: 4000,
          max: 8000
        })
          .then(async function (ports) {
      
            var env_index = 0;
            new_project.environments.forEach((environment) => {
              var project_to_add_to_query = {};
              project_to_add_to_query.project_id = new_project.project_id;
              project_to_add_to_query.git_url = new_project.git_url;
              project_to_add_to_query.environment = environment.name;
              project_to_add_to_query.branch = environment.branch;
              project_to_add_to_query.project_name = new_project.name;
      
              project_to_add_to_query.cluster_port = ports[global.projects_to_deploy.length];
              //We should set port in Parse Server Project object too
              new_project.environments[env_index].cluster_port = project_to_add_to_query.cluster_port;
      
              project_to_add_to_query.project_port = new_project.port;
              project_to_add_to_query.dockerfile = new_project.dockerfile;
              project_to_add_to_query.docker_run_cmd = new_project.docker_run_cmd;
      
              global.projects_to_deploy.push(project_to_add_to_query);
      
              env_index += 1;
              //Add environment domains to query
              environment.domains.forEach((domain) => {
                var domain_to_add_to_query = {};
                domain_to_add_to_query.port = project_to_add_to_query.cluster_port;
                domain_to_add_to_query.domain = domain;
                //Check if it's main domain (project_id.process.env.DOMAIN) or custom domain
                if (domain == environment.domains[0]) {
                  domain_to_add_to_query.target = `${new_project.clusters[0].toLowerCase()}.${process.env.DOMAIN}`;
                } else {
                  domain_to_add_to_query.target = environment.domains[0];
                }
                domain_to_add_to_query.project_id = new_project.project_id;
                global.domains_to_add.push(domain_to_add_to_query);
                console.log("Domain added to domain queue: " + domain_to_add_to_query);
              });
            });
      
            try {
              var project_update = {};
              project_update.environments = new_project.environments;
              const put_res = await superagent.put(Parse.serverURL + '/classes/Project/' + new_project.project_id).send(project_update).set({ 'X-Parse-Application-Id': ParseAppId, 'X-Parse-Session-Token': req.headers['authorization'] }).set('accept', 'json');
              if (put_res.statusCode != 200) {
                res.statusCode = 401;
                res.end(JSON.stringify({ message: "Unable to authenticate you.", id: "unauthorized" }));
                return;
              }
            } catch (err) {
              res.statusCode = 401;
              res.end(JSON.stringify({ message: "Unable to authenticate you.", id: "unauthorized", add_info: err }));
              return;
            }
      
            console.log(req.body);
            res.statusCode = 200;
            res.end(JSON.stringify({}));
      
          });
      
      });
      
      app.get('/sync_project/:project_id', async function (req, res) {
        const logged_user = await handleAllReqs(req, res);
      
        if (logged_user == null) {
          return;
        }
      
        //Get project created in /checking_git request
        var sync_project = {};
        try {
          const get_res = await superagent.get(Parse.serverURL + '/classes/Project/' + req.params.project_id).send({}).set({ 'X-Parse-Application-Id': ParseAppId, 'X-Parse-Session-Token': req.headers['authorization'] }).set('accept', 'json');
      
          if (get_res.statusCode != 200) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Invalid token, cannot get project with id: ' + req.params.project_id }));
            return;
          } else {
            sync_project = get_res.body;
      
            sync_project.environments.forEach((environment) => {
              //Add branch domains to query
              environment.domains.forEach((domain) => {
                var domain_to_add_to_query = {};
                domain_to_add_to_query.port = environment.cluster_port;
                domain_to_add_to_query.domain = domain;
                //Check if it's main domain (project_id.process.env.DOMAIN) or custom domain
                if (domain == environment.domains[0]) {
                  domain_to_add_to_query.target = `${sync_project.clusters[0].toLowerCase()}.${process.env.DOMAIN}`;
                } else {
                  domain_to_add_to_query.target = environment.domains[0];
                }
                domain_to_add_to_query.project_id = sync_project.objectId;
                global.domains_to_add.push(domain_to_add_to_query);
              });
            });
          }
        } catch (err) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: err }));
        }
      
        res.statusCode = 200;
        res.end(JSON.stringify({}));
      
      });

};