#!/bin/sh

ip route add $SIGNET via $SIGNET_GW

iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -s $SIGNET -j ACCEPT
iptables -A INPUT -s $SIGNET -j DROP
iptables -L

cd /app

SCRIPT=${1:-start}

npm run $SCRIPT