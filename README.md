# Deployed.cc Server

Run serverless containers on virtually any cloud or in other words, deploy autoscaled web projects on your own cloud servers directly from Git.

Sounds a bit complicated? Check examples of what can you do using Deployed.cc even if you haven’t any DevOps experience:

1) Deploy local Docker containers on Hetzner servers with HTTPS enabled URLs

2) Deploy an API service & Next.js frontend on DigitalOcean, Vultr, Hetzner, etc. directly from GitHub within minutes

3) Deploy microservices on dedicated servers with unlimited environments

All examples above include horizontal scaling, custom domains with HTTPS, Continuous Deployment with GitOps, and unlimited environments. Hope you got the idea when Deployed.cc can help.

### Components:

- [Server](https://github.com/deployed-cc/deployed-cc-server), manages clients(client=vps/cloud/dedicated server with IP address), creates jobs, handles authorization, manage scaling & deployments on clients
- [Client](https://github.com/deployed-cc/deployed-cc-client) (this repository), runs jobs on each client. Each cloud server where you plan to deploy apps has to have an installed deployed-cc-client
- [Parse Server](https://github.com/parse-community/parse-server), handles users and keeps data

### Scaling modes:

- Manual, when you connect servers using SSH public key and Deployed.cc uses preconnected servers to add/remove containers.
- Automatic, when Deployed.cc uses cloud provider’s API (for example, API from DigitalOcean or ScaleUp) and create/remove servers automatically when your projects need more/fewer resources

### Installation

We recommend using our managed [deployed.cc](https://deployed.cc) service (we have a free plan), but if you want to self-host Deployed.cc you can install it on any server with Ubuntu 20.04 LTS, SSH, and public IP address. How to install on Ubuntu 20.04 LTS:

- Install Podman
- Install Node.js
- Run [Parse Server container]([https://hub.docker.com/r/parseplatform/parse-server](https://hub.docker.com/r/parseplatform/parse-server))
- Clone deployed-cc-server (this repository)
- Update sample.env file with your real values and rename to .env
- Run deployed-cc-server using “npm install & node index.js”
- (Optional) If you want to run deployed-cc-server forever you can install PM2 and run deployed-cc-server using PM2
- (Optional) Install Caddy Server if you want to add a custom domain with HTTPS to your Deployed.cc server
- Create your first user

That’s it. Now you’re ready to connect the first Deployed.cc client and deploy your first serverless container. Use API to connect/remove servers and deploy containers directly from git repositories (CLI will be soon...)

### Limitations

- Custom domains work only with OVH DNS API

### License

- [Server Side Public License](https://www.mongodb.com/licensing/server-side-public-license)

Feel free to contact us at hey[a]deployed.cc if you have any questions
