/*
    git.js
    Methods for managing Git
*/
const dotenv = require('dotenv');
dotenv.config();

const os = require('os');
const home_dir = `${os.homedir()}/`;

const superagent = require('superagent');
const execSync = require('child_process').execSync;
const simpleGit = require('simple-git');

const Parse = require('parse/node');
const ParseAppId = process.env.PARSE_APP_ID;
Parse.initialize(ParseAppId);
Parse.serverURL = process.env.PARSE_SERVER_URL;

const Auth = require("./auth");
const auth = new Auth();

module.exports = function (app) {

    app.post('/check_git', async function (req, res) {
        const logged_user = await auth.handleAllReqs(req, res);
        if (logged_user == null) {
            return;
        }
        const git_url = req.body.git_url;
        //Send response
        res.statusCode = 200;
        res.end(JSON.stringify({ msg: "URL added to a checking query" }));

        var check_git = simpleGit(); //simplegit throws error if don't create it each time
        check_git.clone(git_url, home_dir + "temp_git", [], async (err, summary) => {
            if (err) {
                project_status = 'git_check_failed';
                console.log("Cannot clone git: " + err);
            } else {
                project_status = 'git_check_done';
                console.log("Repository was clonned");
            }
            execSync(`rm -rf ` + home_dir + "temp_git");

            //Update Project status
            try {
                const put_res = await superagent.put(Parse.serverURL + '/classes/Project/' + req.body.project_id).send({ "status": project_status }).set({ 'X-Parse-Application-Id': ParseAppId, 'X-Parse-Session-Token': req.headers['authorization'] }).set('accept', 'json');
                if (put_res.statusCode != 200) {
                    console.log('Invalid token, cannot update project with id: ');
                }
            } catch (err) {
                console.log('Invalid token, cannot update project with id: ');
            }
        });
    });

}