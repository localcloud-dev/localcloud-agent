**Note: The project is in active development - API and workflows are subject to change**

# LocalCloud | Server Agent

[LocalCloud](https://localcloud.dev) is an alternative to [Heroku](https://www.heroku.com/), [Render](https://render.com/), [Platform.sh](https://platform.sh/) and other proprietary PaaS / Serverless. [LocalCloud](https://localcloud.dev) is even more - a multi-cloud/on-premise deployment platform with autoscaling, CI/CD, automated certificate management for TLS certificates, VPN and localhost tunnels without any vendor lock-in. Deploy web and IoT projects on virtually any cloud provider/Raspberry Pi/old laptops in minutes.

More info about the project: [localcloud.dev](https://localcloud.dev)

Contact us if you have any questions: hey[a]localcloud.dev

**Don't forget to click on Star if you like the project.**

#### Multi-cloud and Cloud-agnostic

You can use LocalCloud with virtually any cloud provider. You can even deploy one app on servers from different data centers. There are just 3 conditions for a cloud server - public IP address (required for at least one server inside each project), SSH and Ubuntu 22.04.

#### Developer-friendly

LocalCloud is the API-driven platform. This means that you can do everything using API. Of course, you still can use CLI to manage your projects. For example, you can deploy your webserver with a Dockerfile inside a webserver's repository on a cloud server in just one request.


#### Secure

LocalCloud creates VPN (virtual private network) with cloud servers (servers can be located in different data centers) and local machines (laptops, Desktop computers, Raspberry Pis and other single-board computers ). All requests between servers and local machines are encrypted and sent over VPN that's why you don't need an additional authorization to send messages between services deployed with LocalCloud. Also VPN allows to expose a local webserver via a public URL with automatic HTTPS.


### Main features

- No-Ops & no infrastructure management
- Static websites, Node.js, Golang and virually any runtime environment
- Autoscaler on our managed plans
- CI & CD are included
- Exposing local webservers via a public URL with automatic HTTPS and custom domain
- HTTPS-enabled custom domains
- Works with virtually any VPS / cloud / dedicated server with Ubuntu 22.04 LTS so you can select any cloud provider
- Unlimited environments for each project
- Custom domain for each environment
- GitOps or Push-to-Deploy
- SSH access to servers
- Resource usage monitoring

### Quickstart

LocalCloud uses Git to manage deployments that's why you don’t need to learn new commands or configuration files to deploy your projects. You can use a self-hosted instance of LocalCloud or our fully managed cloud platform.

#### What you need to deploy the first project:
- A fresh (new) server (VPS, Public Cloud, Dedicated Server, etc) with public IP, SSH access, and Ubuntu 22.04. If you don't know where to get a cloud server try Hetzner, Scaleway, OVH or DigitalOcean. All these cloud providers are easier to use and much more cheap than AWS, GCP or Azure.
- A custom domain and access to DNS records of this domain
- Dockerfile in the project's root directory

#### How to deploy a web project

- Add A record to DNS with the public IP address of your server (usually it can be done on a website where you bought a domain). For example, if a public IP of your server is 153.111.51.139 and your custom domain is project.com, you can add  A record lighthouse.project.com -> 153.111.51.139. This is just an example, you should update with your real IP address and domain name.
- SSH into your server
```
ssh root@ip_of_your_server
```
- Install the LocalCloud agent on this server (replace "your_domain" with the real domain, for the example from the step 1 it could be lighthouse.project.com):
```
curl https://localcloud.dev/install | sh -s -- -d your_domain
```
**your_domain** will be used for adding new servers and local machines, and handling Bitbucket, Github and other webhooks; should be without http and https, for example: lighthouse.project.com or agent.domain.com, etc

- Wait until the LocalCloud agent finishes the server provision and run a command on the server

```
localcloud
```
- Select "New Service/App" if you want to deploy a web project. You'll see a step by step guide how to deploy - for most projects it's just 3 simple steps.
- Select "Servers/Local Machines" if you want to install LocalCloud CLI on a local machine (laptops, desktop computers, etc) or add a new server

**Check [localcloud.dev/docs](https://localcloud.dev/docs) for the full documentation**

#### When LocalCloud managed servers will be available?

- June, 2024

#### When the Web Console will be available?

- June, 2024

### License

- [Server Side Public License](https://www.mongodb.com/licensing/server-side-public-license)

### Awesome open-source projects that we use in LocalCloud

- [Nebula](https://github.com/slackhq/nebula). Nebula was created at Slack Technologies, Inc by Nate Brown and Ryan Huber, with contributions from Oliver Fross, Alan Lam, Wade Simmons, and Lining Wang. Nebula is licensed under the [MIT License](https://github.com/slackhq/nebula/blob/master/LICENSE).
- [Caddy](https://github.com/caddyserver/caddy). Matthew Holt began developing Caddy in 2014 while studying computer science at Brigham Young University. Caddy is a registered trademark of Stack Holdings GmbH. Caddy is a project of [ZeroSSL](https://zerossl.com/), a Stack Holdings company. Caddy is licensed under the [Apache License 2.0](https://github.com/caddyserver/caddy/blob/master/LICENSE).
