#!/bin/sh

if [ -z "$2" ]
then
  echo ""
  echo ""
  echo "No join VPN URL is specified in the command. Use 'curl https://localcloud.dev/setup/linux | sh -s join join_vpn_url', where join_vpn_url is an URL that you can get after a new machine is added to your LocalCloud project. More information can be found at https://localcloud.dev/docs"
  echo ""
  echo ""
  exit 0
fi

#Install npm & node.js
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
DEBIAN_FRONTEND=noninteractive sudo apt-get update
DEBIAN_FRONTEND=noninteractive sudo apt-get install nodejs -y
sudo npm install -g npm

#Install Nebula
cd $HOME

#Get architecture
OSArch=$(uname -m)
if [ "$OSArch" = "aarch64" ]; then
    wget https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-arm64.tar.gz 
    tar -xzf nebula-linux-arm64.tar.gz
    rm nebula-linux-arm64.tar.gz
else
    wget https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-amd64.tar.gz 
    tar -xzf nebula-linux-amd64.tar.gz
    rm nebula-linux-amd64.tar.gz
fi

sudo chmod +x nebula
sudo mv nebula /usr/local/bin/nebula

sudo chmod +x nebula-cert
sudo mv nebula-cert /usr/local/bin/nebula-cert

sudo mkdir /etc/nebula


if [ "$1" = "join" ]; then

    echo "Downloading a zip archive with Nebula certificates"
    DEBIAN_FRONTEND=noninteractive  sudo apt-get install unzip
    wget $2 -O deployed-join-vpn.zip
    unzip -o deployed-join-vpn.zip
    sudo mv config.yaml /etc/nebula/config.yaml
    sudo mv ca.crt /etc/nebula/ca.crt
    sudo mv host.crt /etc/nebula/host.crt
    sudo mv host.key /etc/nebula/host.key

    sudo rm deployed-join-vpn.zip
    
    sudo ufw allow from 192.168.202.0/24

    #Start Nebula
    sudo rm /etc/systemd/system/localcloud-nebula.service
    sudo sh -c -e "echo '[Unit]\nDescription=Nebula overlay networking tool\nWants=basic.target network-online.target nss-lookup.target time-sync.target\nAfter=basic.target network.target network-online.target\nBefore=sshd.service' >> /etc/systemd/system/localcloud-nebula.service"
    sudo sh -c -e "echo '[Service]\nSyslogIdentifier=nebula\nExecReload=/bin/kill -HUP $MAINPID\nExecStart=/usr/local/bin/nebula -config /etc/nebula/config.yaml\nRestart=always' >> /etc/systemd/system/localcloud-nebula.service"
    sudo sh -c -e "echo '[Install]\nWantedBy=multi-user.target' >> /etc/systemd/system/localcloud-nebula.service"

    STATUS="$(systemctl is-active localcloud-nebula.service)"
    if [ "${STATUS}" = "active" ]; then
        #systemctl reload doesn't work for Nebula, that's why we should stop/start the daemon if localcloud-cli already installed on this machine
        sudo systemctl stop localcloud-nebula.service
    else 
        sudo systemctl enable localcloud-nebula.service
    fi

    sudo systemctl start localcloud-nebula.service

fi

#Install LocalCloud CLI
sudo npm install -g https://github.com/localcloud-dev/localcloud-cli

echo ""
echo ""
echo "==================================================================================="
echo ""
echo "LocalCloud CLI is installed. Run \"localcloud\" to start."
echo ""
echo "==================================================================================="
echo ""
echo ""