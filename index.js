const dotenv = require('dotenv');
dotenv.config();

const os = require('os');
const home_dir = `${os.homedir()}/`;

const polka = require('polka');
const app = polka();

const { json } = require('body-parser');
const serveStatic = require('serve-static');
const cors = require('cors');

app.use(cors());
app.use(json());
app.use(serveStatic('certs'));

//Load config
const fs = require('fs');
global.cluster_config = {};
try {
  global.cluster_config = JSON.parse(fs.readFileSync(home_dir + '.deployed/config.json', 'utf8'));
} catch (e) {
  console.log('Cannot load public key:', e.stack);
}

//Projects to deploy
global.projects_to_deploy = [];
global.projects = [];
try {
  global.projects = JSON.parse(fs.readFileSync(home_dir + '.deployed/projects.json', 'utf8'));
  console.log(projects);
} catch (e) {
  console.log('No projects.json file yet');
}

//Domain to add to this cluster
//We add new domains only if there no projects to deploy in the query
global.domains_to_add = [];

//Create routes
require("./routes/environment")(app);
require("./routes/deployment")(app);
require("./routes/git")(app);
require("./routes/project")(app);
require("./routes/stats")(app);

//Start deployment queue
const deployment_int = require("./internal/deployment_int");
setInterval(deployment_int.deployNext, process.env.CHECK_DEPLOYMENT_QUEUE_INTERVAL);

//Start monitoring queue
const monitoring = require("./internal/monitoring");
setInterval(monitoring.getStats, process.env.CHECK_DEPLOYMENT_QUEUE_INTERVAL);

//Checking if all microservices work
app.get('/hey', (req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ message: 'Working well!' }));
});

app.listen(process.env.PORT, err => {
  if (err) throw err;
  console.log(`> Deployed.cc Client Agent is running on port ${process.env.PORT}`);
});
