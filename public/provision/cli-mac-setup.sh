#!/bin/sh

if [ -z "$2" ]
then
  echo ""
  echo ""
  echo "No join VPN URL is specified in the command. Use 'curl https://localcloud.dev/setup/mac | sh -s join join_vpn_url', where join_vpn_url is an URL that you can get after a new machine is added to your LocalCloud project. More information can be found at https://localcloud.dev/docs"
  echo ""
  echo ""
  exit 0
fi

#Install npm & node.js
curl https://nodejs.org/dist/v20.10.0/node-v20.10.0.pkg -o $HOME/Downloads/node-latest.pkg && sudo installer -store -pkg $HOME/Downloads/node-latest.pkg -target /
rm $HOME/Downloads/node-latest.pkg
sudo npm install -g npm

#Install Nebula
cd $HOME

#Get architecture
curl https://github.com/slackhq/nebula/releases/download/v1.7.2/nebula-darwin.zip -L -o nebula-darwin-localcloud.zip
unzip -o nebula-darwin-localcloud.zip
rm nebula-darwin-localcloud.zip

sudo chmod +x nebula
sudo mv nebula /usr/local/bin/nebula

sudo chmod +x nebula-cert
sudo mv nebula-cert /usr/local/bin/nebula-cert

sudo mkdir /etc/nebula

if [ "$1" = "join" ]; then

    echo "Downloading a zip archive with Nebula certificates"
    curl $2 -L -o localcloud-join-vpn.zip
    unzip -o localcloud-join-vpn.zip

    sudo mv config.yaml /etc/nebula/config.yaml
    sudo mv ca.crt /etc/nebula/ca.crt
    sudo mv host.crt /etc/nebula/host.crt
    sudo mv host.key /etc/nebula/host.key

    sudo rm localcloud-join-vpn.zip

    #Start Nebula with launchd
    sudo rm /Library/LaunchDaemons/com.localcloud.nebula.plist
    sudo curl https://raw.githubusercontent.com/localcloud-dev/localcloud-agent/main/public/provision/launchd_nebula_template.plist -L -o /Library/LaunchDaemons/com.localcloud.nebula.plist
    sudo launchctl unload /Library/LaunchDaemons/com.localcloud.nebula.plist
    sudo launchctl load /Library/LaunchDaemons/com.localcloud.nebula.plist

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