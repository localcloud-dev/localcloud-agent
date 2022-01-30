const dotenv = require('dotenv');
dotenv.config();

const os = require('os');
const home_dir = `${os.homedir()}/`;

const backend_api_endpoint = process.env.DEPLOYED_CC_SERVER_API_ENDPOINT;
const haproxy_cfg_path = '/etc/haproxy/haproxy.cfg';

const superagent = require('superagent');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const simpleGit = require('simple-git');

//DNS API
var dns = require('dns');
const fs = require('fs');

var is_adding_new_domain = false;
var is_deploy_machine_busy = false;

function deployNext() {
    if (global.projects_to_deploy.length > 0 && is_deploy_machine_busy == false && is_adding_new_domain == false) {
        is_deploy_machine_busy = true;
        const next_project_to_deploy = projects_to_deploy[0];
        global.projects_to_deploy.splice(0, 1);
        deployProject(next_project_to_deploy);
    } else if (global.projects_to_deploy.length == 0 && is_deploy_machine_busy == false) {
        //Check if we have domains in the query
        if (global.domains_to_add.length > 0 && is_adding_new_domain == false) {
            is_adding_new_domain = true;
            //Check if DNS has CNAME record with this domain
            const next_domain_to_add = global.domains_to_add[0];
            dns.resolveCname(next_domain_to_add.domain, function (err, records, family) {
                var rec_found = false;

                console.log(records);
                console.log(err);

                if (records != undefined && err == null){
                    for (var rec of records) {
                        if (rec == next_domain_to_add.target){
                            rec_found = true;
                            global.domains_to_add.splice(0, 1);
                            //ToDo
                            addDomain(next_domain_to_add);
                        }
                      }
                }

                if (rec_found == false){
                    //ToDo
                    global.domains_to_add.shift();
                    global.domains_to_add.push(next_domain_to_add);
                    is_adding_new_domain = false;
                }
            });
        }
    }
}

async function deployProject(project_to_deploy) {

    const git_url = project_to_deploy.git_url;
    const branch = project_to_deploy.branch;
    const environment = project_to_deploy.environment.toLowerCase();
    const project_name = project_to_deploy.project_name;
    const cluster_port = project_to_deploy.cluster_port;
    const container_port = project_to_deploy.project_port;
    const dockerfile_content = project_to_deploy.dockerfile;

    //Check if we should deploy a marketplace app
    if (project_to_deploy.git_url == '' || project_to_deploy.git_url == undefined) {
        //One click app
        const run_container_cmd = project_to_deploy.docker_run_cmd.replaceAll('{{cluster_port}}', cluster_port);
        exec(run_container_cmd, function (err, stdout, stderr) {
            git.log(branch, async (err, info) => {
                if (err) {
                    console.log(err);
                } else {
                    const latest_commit = info.latest;
                    //Send notification that deploy finished
                    var start_event = {};
                    start_event.project_id = project_to_deploy.project_id;
                    start_event.cluster_id = global.cluster_config.cluster_id;
                    start_event.branch = project_to_deploy.branch;
                    start_event.environment = project_to_deploy.environment;
                    start_event.commit_msg = latest_commit.message;
                    start_event.commit_id = latest_commit.hash;
                    start_event.msg = "deploy_finish";

                    try {
                        const put_res = await superagent.post(`${backend_api_endpoint}/event`).send(start_event).set({ 'notification-key': global.cluster_config.notification_key }).set('accept', 'json');
                        if (put_res.statusCode == 201) {
                            //ToDo
                        } else {
                            //ToDo
                        }
                        is_deploy_machine_busy = false; //Cluster is ready for next deployment
                    } catch (err) {
                        //ToDo
                        is_deploy_machine_busy = false; //Cluster is ready for next deployment
                    }

                }
            });

        });

    } else {
        //Deploy a project from a git repository (non marketplace app)
        //Remove cloned repo
        var rm_repo_cmd = `rm -rf ${home_dir + project_name}`;
        execSync(rm_repo_cmd);

        git = simpleGit(); //simplegit throws error if don't create it each time
        git.clone(git_url, home_dir + project_name, [], (err, mergeSummary) => {
            if (err) {
                console.log(err);
            } else {
                git.cwd({ path: home_dir + project_name, root: true }, (err, mergeSummary) => {
                    git.pull(branch, (err, mergeSummary) => {
                        if (err) {
                            //ToDo
                        } else {
                            git.checkout(branch, (err, mergeSummary) => {
                                if (err) {
                                    //ToDo
                                } else {

                                    git.log(branch, async (err, info) => {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            const latest_commit = info.latest;
                                            //Send notification that deploy started
                                            var start_event = {};
                                            start_event.project_id = project_to_deploy.project_id;
                                            start_event.cluster_id = global.cluster_config.cluster_id;
                                            start_event.branch = project_to_deploy.branch;
                                            start_event.environment = project_to_deploy.environment;
                                            start_event.commit_msg = latest_commit.message;
                                            start_event.commit_id = latest_commit.hash;
                                            start_event.msg = "deploy_start";

                                            try {
                                                const put_res = await superagent.post(`${backend_api_endpoint}/event`).send(start_event).set({ 'notification-key': global.cluster_config.notification_key }).set('accept', 'json');
                                                if (put_res.statusCode == 201) {
                                                    //ToDo
                                                } else {
                                                   //ToDo
                                                }
                                            } catch (err) {
                                                //ToDo
                                            }
                                        }
                                    });

                                    fs.writeFileSync(home_dir + project_name + '/Dockerfile', dockerfile_content);
                                    var rm_image_cmd = `docker image rm ${project_name}-${environment} --force`;
                                    execSync(rm_image_cmd);

                                    var build_image_cmd = `cd ${home_dir + project_name} && docker build . -t ${project_name}-${environment}`;
                                    exec(build_image_cmd, function (err, stdout, stderr) {
                                        var rm_container_cmd = `docker container rm ${project_name}-${environment} --force`;
                                        execSync(rm_container_cmd);
                                        var run_container_cmd = `docker run -p ${cluster_port}:${container_port} -d --restart unless-stopped --name ${project_name}-${environment} ${project_name}-${environment}`;
                                        exec(run_container_cmd, function (err, stdout, stderr) {
                                            git.log(branch, async (err, info) => {
                                                if (err) {
                                                    console.log(err);
                                                } else {
                                                    const latest_commit = info.latest;
                                                    //Send notification that deploy finished
                                                    var start_event = {};
                                                    start_event.project_id = project_to_deploy.project_id;
                                                    start_event.cluster_id = global.cluster_config.cluster_id;
                                                    start_event.branch = project_to_deploy.branch;
                                                    start_event.environment = project_to_deploy.environment;
                                                    start_event.commit_msg = latest_commit.message;
                                                    start_event.commit_id = latest_commit.hash;
                                                    start_event.msg = "deploy_finish";

                                                    try {
                                                        const put_res = await superagent.post(`${backend_api_endpoint}/event`).send(start_event).set({ 'notification-key': global.cluster_config.notification_key }).set('accept', 'json');
                                                        if (put_res.statusCode == 201) {
                                                            console.log('Event created');
                                                        } else {
                                                            console.log(put_res.body);
                                                        }
                                                        is_deploy_machine_busy = false; //Cluster is ready for next deployment
                                                    } catch (err) {
                                                        console.log('Cannot create Event');
                                                        is_deploy_machine_busy = false; //Cluster is ready for next deployment
                                                    }

                                                }
                                            });

                                        });
                                    });
                                }
                            });
                        }
                    });
                });
            }

        });
        console.log("after");
    }
}

function addProjectToQuery(repo_name, updated_branch) {
    global.projects.forEach((project) => {
        if (project.git_url.endsWith(`${repo_name}.git`) == true) {
            project.environments.forEach((branch) => {
                if (branch.branch == updated_branch) {
                    var project_to_add_to_query = {};
                    project_to_add_to_query.project_id = project.project_id;
                    project_to_add_to_query.git_url = project.git_url;
                    project_to_add_to_query.environment = branch.name;
                    project_to_add_to_query.branch = branch.branch;
                    project_to_add_to_query.project_name = project.name;
                    project_to_add_to_query.cluster_port = branch.cluster_port;
                    project_to_add_to_query.project_port = project.port;
                    project_to_add_to_query.dockerfile = project.dockerfile;
                    project_to_add_to_query.docker_run_cmd = project.docker_run_cmd;

                    global.projects_to_deploy.push(project_to_add_to_query);

                    return;
                }
            });
        }
    });
}


function addDomain(domain_to_add) {
    generateSSL(domain_to_add.domain, domain_to_add.port);
}

function generateSSL(domain, port) {
    var haproxy_cfg = '';
    try {
        haproxy_cfg = fs.readFileSync(haproxy_cfg_path, 'utf8');
    } catch (e) {
        console.log('Cannot load HAProxy config:', e.stack);
    }

    //Check if this domain is already in haproxy
    if (haproxy_cfg.indexOf(domain) !== -1) {
        is_adding_new_domain = false;
        return;
    }

    var subdomain = domain.split('.')[0];
    var new_frontend = `#====frontends======
acl ${subdomain}-dep hdr(host) -i  ${domain}
use_backend dep-cluster if ${subdomain}-dep

`;
    haproxy_cfg = haproxy_cfg.replace(`#====frontends======`, new_frontend);

    var new_backend = `#====backends======
backend ${subdomain}-backend
   balance roundrobin
   server ${subdomain}-srv 127.0.0.1:${port}

`;
    haproxy_cfg = haproxy_cfg.replace(`#====backends======`, new_backend);
    fs.writeFileSync(haproxy_cfg_path, haproxy_cfg);
    execSync(`sudo systemctl restart haproxy`);

    //Generate SSL certificate with certbot
    //  var certbot_cmd = `certbot certonly --staging --non-interactive --agree-tos -m dev@${process.env.DOMAIN} --webroot -w /root/dep-cluster/certs -d ${domain}`;

    var certbot_cmd = `certbot certonly --non-interactive --agree-tos -m dev@${process.env.DOMAIN} --webroot -w /root/dep-cluster/certs -d ${domain}`;
    exec(certbot_cmd, function (err, stdout, stderr) {
        var generate_pem_cmd = `DOMAIN='${domain}' sudo -E bash -c 'cat /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/letsencrypt/live/$DOMAIN/privkey.pem > /etc/haproxy/certs/$DOMAIN.pem'`;
        execSync(generate_pem_cmd);

        //Add new certificate to haproxy.cfg
        haproxy_cfg = haproxy_cfg.replace(`bind *:443 ssl`, `bind *:443 ssl crt /etc/haproxy/certs/${domain}.pem`);
        haproxy_cfg = haproxy_cfg.replace(`use_backend dep-cluster if ${subdomain}-dep`, `use_backend ${subdomain}-backend if ${subdomain}-dep`);
        fs.writeFileSync(haproxy_cfg_path, haproxy_cfg);
        execSync(`sudo systemctl restart haproxy`);
        is_adding_new_domain = false;
    });

    String.prototype.replaceAll = function (str1, str2, ignore) {
        return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "\\$&"), (ignore ? "gi" : "g")), (typeof (str2) == "string") ? str2.replace(/\$/g, "$$$$") : str2);
      }
}

module.exports = { addDomain, deployProject, deployNext, addProjectToQuery };
