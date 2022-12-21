const dotenv = require('dotenv');
dotenv.config();

const os = require('os');
const home_dir = `${os.homedir()}/`;

const polka = require('polka');
const app = polka();

const { json } = require('body-parser');
const cors = require('cors');

app.use(cors());
app.use(json());

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
global.logger = logger;

//Log examples:
//logger.info('Some info');
//logger.error('Some error');

//Load config
const fs = require('fs');
global.service_node_config = {};
try {
  global.service_node_config = JSON.parse(fs.readFileSync(home_dir + '.deployed-config.json', 'utf8'));
} catch (e) {
  global.logger.info('No config file ~/.deployed-config.json has been found');

  //Create a new config file
  //Use env.PORT.BASE_PRIVATE_IP to generate private IPs for VPN nodes
  global.service_node_config.vpn_nodes = [];
}

global.service_node_config.port = process.env.PORT || 5005;
global.service_node_config.domain = process.env.SERVICE_NODE_DOMAIN;

//Projects to deploy
try {
  global.projects = JSON.parse(fs.readFileSync(home_dir + '.deployed-projects.json', 'utf8'));
  console.log(projects);
} catch (e) {
  global.logger.info('No projects file ~/.deployed-projects.json has been found');
  global.projects = [];
}

//Create routes
const deployment = require("./routes/deployment");
setInterval(deployment.check_deployment_query, 1000);

//Load other modules
const proxy = require("./routes/proxy");
proxy.proxy_reload();

//Routes
require("./routes/service")(app);
require("./routes/deploy")(app);
require("./routes/vpn")(app);

//Check if service-node works
app.get('/hey', (req, res) => {
  res.statusCode = 200;
  res.end(JSON.stringify({ message: `I'm fine!` }));
});

app.listen(global.service_node_config.port, err => {
  if (err) throw err;
  global.logger.info(`Deployed.cc service node is running on port ${global.service_node_config.port}`);
});
