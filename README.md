# Network controller

Exposes API to manage signaling network and coordinates network operation by conneting all network components.
Endpoints of this service should not be exposed publically. 

## Setup

This service is part of signaling network and is not intended to run as standalone. See docker-compose.yml in service-gateway repo for more details.

## API

This is a low level network API and it does not have authentication mechanism. It should be accessed only by a higher level API that maps access points to users and validates credentials.

### Access Points

Access points are identified by a v4 uuid.

#### Register access point

Registering access point to the network, first generate uuid, lookup MAC address of the access point and POST to API:

```
curl controller/access-points -H "Content-Type: application/json" -d'{"accessPointId": "--generated-uuid--", "macAddress": "--mac-address--"}'
```

Controller will respond with json object, which includes:
- signaling network keys (key, certificate, and ca certificate)
- public IP address of signaling network entry point (OpenVPN service)
- remote management key pair
- RADIUS IP accessible through the signaling network
- RADIUS secret
- captive portal secret

Access point configured with these parameters should be able to operate in IUNGO network.

#### Remove access point from network

To remove access point from network and disconnect it immediatelly:

```
curl -X POST controller/access-points/--access-point-id--/kill
```

Credentials of access point will be revoked and access point will be disconnected from the network immediatelly.

#### Access point management

Controller has ability to connect to access point and run predefined tasks. Tasks are now executed syncronically, output of the call contains parameter "success" set to 1 if call was successful.

Change SSID of the AP:
```
curl controller/access-points/--access-point-id--/tasks/setSsid -H "Content-Type: application/json" -d'{"ssid": "New SSID"}'
```

Reboot AP:
```
curl -X POST controller/access-points/--access-point-id--/tasks/reboot
```

### Users

Users are identified by a v4 uuid. User in this context means an entity that can connect to the network, it could be a device, not a person.

#### Create user

To create a user, first generate uuid and POST to controller:
```
curl controller/users -H "Content-Type: application/json" -d'{"userId": "--generated-uuid--"}'
```
Controller will respond with json object containing user password. User now should be able to access the network via configured access point.

#### Disable user

To disable a user, POST to controller:
```
curl -X POST controller/users/--user-id--/disable
```
User will no longer be able to authenticate, but the current active session will not be interrupted.

### Other functions

API also exposes some endpoints for captivity, security, signaling network and accounting services.

## REPL interface

Controller has REPL interface to allow debugging of components and provide access to advanced management such as remote firmware upgrade etc. To enable this interface set env var REPL_ENABLED=1 and choose a port with REPL_PORT=5000 (default).

To access it telnet to chosen port (you may need to rlwrap the telnet session). Make sure it is not accessible publically. Network functions are exposed via `iungo` variable.
