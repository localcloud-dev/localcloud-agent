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

const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `info.log`
    //
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'info.log' }),
  ],
});
//Log examples:
//logger.info('Some info');
//logger.error('Some error');

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

//We add new domains only if there no projects to deploy in the query
global.domains_to_add = [];

//Create routes
require("./routes/git")(app);
require("./routes/stats")(app);

//Start deployment queue
//const deployment_int = require("./internal/deployment_int");
//setInterval(deployment_int.deployNext, process.env.CHECK_DEPLOYMENT_QUEUE_INTERVAL);
require("./internal/job_manager")(logger);

//Start monitoring queue
const monitoring = require("./internal/monitoring");
const { notStrictEqual } = require('assert');
setInterval(monitoring.getStats, process.env.CHECK_DEPLOYMENT_QUEUE_INTERVAL);

//Check if deployed-client works
app.get('/hey', (req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ message: `I'm nice, guys!` }));
});

app.listen(process.env.PORT, err => {
  if (err) throw err;
  console.log(`> Deployed.cc Client Agent is running on port ${process.env.PORT}`);
});
