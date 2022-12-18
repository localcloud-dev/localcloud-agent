const fs = require('fs');

function save_projects(){
    var json = JSON.stringify(global.projects);
    fs.writeFile(require('os').homedir() + '/.deployed-projects.json', json, err => {
        if (err) {
            global.logger.error(`Cannot save projects to file ~/.deployed-projects.json. Error: ${err}`);
        }
      });
}

module.exports = {save_projects}

