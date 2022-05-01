/*
    git.js
    Methods for managing Git
*/
const dotenv = require('dotenv');
dotenv.config();

const os = require('os');
const home_dir = `${os.homedir()}/`;

const simpleGit = require('simple-git');


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

        });
    });

}