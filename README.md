**Note: The project is in active development - please, use it only for non-production environments until we release version 1.0**

# Deployed.cc | Service Node

[Deployed.cc](https://deployed.cc) is the multi-cloud developer-friendly secure Platform as a service (PaaS).

More info about the project: [deployed.cc](https://deployed.cc)

Contact us if you have any questions: hey[a]deployed.cc

**Don't forget to click on Star if you like the idea.**

#### Multi-cloud and Cloud-agnostic

You can use Deployed.cc with virtually any cloud provider. You can even deploy one app on servers from different data centers. There are just 3 conditions for a cloud server - public IP address, SSH and Ubuntu 22.04.

#### Developer-friendly

Deployed.cc is the API-driven platform. This means that you can do everything using API. Of course, you still can use CLI to manage your projects. For example, you can deploy your webserver with a Dockerfile inside a webserver's repository on a cloud server in just one request:

**API Request Example:**
```

curl -XPOST -H "Content-type: application/json" -d '{
    "git_url":"git@bitbucket.org:company/repository.git",
    "environments":[{
        "name":"master",
        "branch":"master",
        "domain":"project.yourdomain.com",
        "port":"4008"
    }]
}' 'https://deployed.yourdomain.com/service'

```


#### Secure

By default Deployed.cc creates VPN (virtual private network) with cloud servers (servers can be located in different data centers) and local machines (laptops, Desktop computers, even Raspberry Pis ). All requests between servers and local machines are sent over VPN. Also VPN allows to expose a local webserver via a public URL with automatic HTTPS.


### Main features

- No-Ops & no infrastructure management
- Static websites, Node.js, Golang and virually any runtime environment
- CI & CD
- Exposing local webservers via a public URL with automatic HTTPS and custom domain
- HTTPS-enabled custom domains
- Works with virtually any VPS / cloud / dedicated server with Ubuntu 22.04 LTS
- Unlimited environments for each project
- Custom domain for each environment
- GitOps or Push-to-Deploy
- SSH access to servers
- Resource usage monitoring
- Open source

### Quickstart

Deployed.cc uses Git to manage deployment that's why you don’t need to learn new commands or configuration files to deploy your projects. You can use a self-hosted instance of Deployed or our fully managed cloud platform (soon).

#### What you need to deploy the first project:
- A fresh (new) server (VPS, Public Cloud, Dedicated Server, etc) with public IP, SSH access, and Ubuntu 22.04. If you don't know where to get a cloud server try Hetzner, Scaleway, OVH or DigitalOcean. All these cloud providers are easier to use and much more cheap than AWS, GCP or Azure.
- A custom domain and access to DNS records of this domain
- Dockerfile in the project's root directory

#### How to deploy a project with self-hosted Deployed.cc

- Add A record to DNS with the public IP address of your server. For example, if a public IP of your server is 153.111.51.139 and your custom domain is project.com, you can add a wildcard A record *.test.project.com -> 153.111.51.139. This is just an example, you should update with your real IP address and domain name.
- SSH into your server
- Install the service-node agent on this server (replace "service_node_domain" with your domain, for the example in the step 1 it could be agent.test.project.com):
```
curl https://raw.githubusercontent.com/deployed-cc/service-node/main/public/provision/deployed-service-node-install.sh | sh -s service_node_domain
```
**service_node_domain** will be used for Bitbucket, Github and other webhooks, should be without http and https, for example: agent.test.project.com or deploy.domain.com, etc

- Wait until the service-node agent finishes the server provision and follow the steps in the final message. If everything goes well, you'll see something like this:
```
To deploy a first project you should:

- install Deploy CLI on your local machine (on your laptop, iMac, Desktop computer etc.). Run in Terminal/Console (NPM should be installed on your system):
      
    npm install -g https://github.com/deployed-cc/deployed-cli

...
```

#### How to deploy a project with cloud Deployed.cc

- Will be available from March, 2023


### License

- [Server Side Public License](https://www.mongodb.com/licensing/server-side-public-license)

### Awesome open-source projects that we use in Deployed.cc

- [Nebula](https://github.com/slackhq/nebula). Nebula was created at Slack Technologies, Inc by Nate Brown and Ryan Huber, with contributions from Oliver Fross, Alan Lam, Wade Simmons, and Lining Wang. Nebula is licensed under the [MIT License](https://github.com/slackhq/nebula/blob/master/LICENSE).
- [Caddy](https://github.com/caddyserver/caddy). Matthew Holt began developing Caddy in 2014 while studying computer science at Brigham Young University. Caddy is a registered trademark of Stack Holdings GmbH. Caddy is a project of [ZeroSSL](https://zerossl.com/), a Stack Holdings company. Caddy is licensed under the [Apache License 2.0](https://github.com/caddyserver/caddy/blob/master/LICENSE).
