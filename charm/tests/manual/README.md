# Manual testing: Athena charm on MicroK8s

This guide walks through standing up a local Kubernetes environment and manually
exercising the Athena charm end to end: provisioning a Multipass VM, bootstrapping
MicroK8s with Juju, packing and deploying the charm with
[pack-and-deploy.sh](./pack-and-deploy.sh), integrating PostgreSQL, wiring up
ingress, applying the [dex.yaml](./dex.yaml) OIDC provider, and forwarding traffic
so the app is reachable from the host at `http://athena.localhost`.

The published hostname for the app is **`athena.localhost`**, and the OIDC provider
is served at **`dex.localhost`**. Inside the cluster these resolve to the MicroK8s
node via CoreDNS (step 11); on your workstation they always resolve to loopback
(`127.0.0.1`), so a `socat` forwarder bridges loopback into the VM (step 12).

> These are the same steps automated by the charm integration tests
> (`charm/tests/integration/`). Run them by hand when you want a browser-reachable
> deployment to click through.

## Prerequisites (on the host)

- [Multipass](https://canonical.com/multipass)
- Sudo access to edit `/etc/hosts` on the host

Everything else (MicroK8s, Juju, LXD, rockcraft, charmcraft) is installed inside
the Multipass VM in the steps below.

## 1. Provision the Multipass VM (on the host)

Create a VM with enough resources to build the rock and run MicroK8s, mount the
repo into it, and open a shell.

```bash
multipass launch 24.04 --name athena --cpus 4 --memory 8G --disk 50G
multipass stop athena
multipass mount /path/to/athena athena:/home/ubuntu/athena
multipass shell athena
```

Run every subsequent command inside the VM unless it is explicitly marked
"(on the host)".

## 2. Install the toolchain inside the VM

```bash
sudo snap install lxd && sudo lxd init --auto
sudo snap install rockcraft --classic
sudo snap install charmcraft --classic
sudo snap install jq

sudo snap install microk8s --channel 1.31-strict/stable
sudo usermod -a -G snap_microk8s "$USER"
newgrp snap_microk8s
```

## 3. Enable MicroK8s addons

The registry (`localhost:32000`), storage, and ingress addons are all required by
the deploy script and the charm.

```bash
sudo microk8s enable hostpath-storage
sudo microk8s enable registry
sudo microk8s enable ingress
sudo microk8s status --wait-ready
```

## 4. Bootstrap Juju on MicroK8s

```bash
sudo snap install juju --channel 3.6/stable
mkdir -p ~/.local/share
juju bootstrap microk8s dev-controller
```

The [pack-and-deploy.sh](./pack-and-deploy.sh) script adds and switches to the
`athena` model automatically, but you can create it now if you prefer:

```bash
juju add-model athena
```

## 5. Pack and deploy

From the mounted repository root, run the deploy helper. It stages the app, packs
the rock, pushes it to the MicroK8s registry, packs the charm, and deploys (or
refreshes) the `athena` application.

```bash
cd /home/ubuntu/athena
./charm/tests/manual/pack-and-deploy.sh
```

Watch the deployment settle:

```bash
juju status --watch 2s
```

The app will report **blocked** until PostgreSQL is integrated and the required
secrets are configured — that is expected and handled next.

## 6. Integrate PostgreSQL

```bash
juju deploy postgresql-k8s --channel 14/stable --trust
juju integrate athena postgresql-k8s
```

## 7. Provide the required secrets

The charm needs three Juju user secrets. Create them, grant them to `athena`, and
point the matching config options at them.

```bash
OIDC_URI=$(juju add-secret athena-oidc client-secret=super-secret-value)
CRED_URI=$(juju add-secret athena-credential encryption-key=local-encryption-key)
SESSION_URI=$(juju add-secret athena-session key=local-session-secret)

juju grant-secret athena-oidc athena
juju grant-secret athena-credential athena
juju grant-secret athena-session athena

juju config athena \
  oidc="$OIDC_URI" \
  credential="$CRED_URI" \
  secret="$SESSION_URI"
```

The secret client-secret value (`super-secret-value`) must match the `athena`
static client secret in [dex.yaml](./dex.yaml).

## 8. Allow insecure OIDC for local testing

The expressjs-framework extension sets `NODE_ENV=production`, which blocks OIDC
discovery over plain HTTP. Override it so the local Dex (served over `http://`)
is accepted:

```bash
juju config athena node-env=development
```

## 9. Set up ingress

Deploy the ingress integrator and publish the app at `athena.localhost`. The
MicroK8s `ingress` addon (nginx) serves the resulting Kubernetes Ingress resource.

```bash
juju deploy nginx-ingress-integrator --channel latest/stable --trust
juju integrate athena nginx-ingress-integrator
juju config nginx-ingress-integrator service-hostname=athena.localhost
```

### Serve the app at the site root

The `nginx-ingress-integrator` publishes the app under a path prefix derived from
the Juju model and app names — `/athena-athena/` — stripping the prefix before it
reaches the workload. Athena's frontend, however, is built with a **root** base
path (its assets load from `/assets/...`) and its OIDC callback is **root**
(`/api/authentication/callback`). Under the prefix the HTML loads but every asset
and the login callback 404, so the app is unusable at `http://athena.localhost/`.

Add a second Ingress that routes the site root straight to the `athena` app
service (which serves the whole app at root on port 8080) so the frontend, assets,
and OIDC callback all resolve:

```bash
cat <<'EOF' | microk8s kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: athena-root
  namespace: athena
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: HTTP
spec:
  ingressClassName: public
  rules:
  - host: athena.localhost
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: athena
            port:
              number: 8080
EOF
```

## 10. Apply the Dex OIDC deployment

Athena authenticates against Dex. Deploy the manifest into the cluster:

```bash
microk8s kubectl apply -f charm/tests/manual/dex.yaml
microk8s kubectl -n dex rollout status deploy/dex
```

Dex is now served through the ingress at `dex.localhost`.

## 11. Let the Athena pod resolve the `.localhost` hosts

The Athena pod performs OIDC discovery against `dex.localhost`, and Dex redirects
back to `athena.localhost`. Neither name resolves inside the cluster by default, so
add a `hosts` block to CoreDNS pointing both names at the MicroK8s node IP.

```bash
# Node IP that the ingress hostPort binds to.
NODE_IP=$(microk8s kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
echo "Node IP: $NODE_IP"

microk8s kubectl -n kube-system edit configmap coredns
```

Inside the `Corefile` data, add a `hosts` block (replace `NODE_IP` with the value
printed above) just after the `errors` line:

```text
hosts {
    NODE_IP dex.localhost
    NODE_IP athena.localhost
    fallthrough
}
```

Restart CoreDNS and the Athena pod so discovery picks up the new records:

```bash
microk8s kubectl -n kube-system rollout restart deploy/coredns
juju status --watch 2s   # wait for athena to reach active
```

Confirm the whole model is active:

```bash
juju status
```

## 12. Reach the app from your workstation

`athena.localhost` and `dex.localhost` are special. Per RFC 6761, glibc's
`getaddrinfo()` and every mainstream browser resolve any `*.localhost` name to
loopback (`127.0.0.1`/`::1`) and **ignore `/etc/hosts`**. You therefore cannot
point these names at the VM's IP with a hosts entry — instead make loopback itself
forward into the VM.

**a. Find the VM IP (on the host).**

```bash
multipass info <vm-name> | grep IPv4   # e.g. 10.86.41.98
```

**b. Forward loopback:80 into the VM.** On the machine where your browser runs
(the host, or WSL if that is where you browse), run a `socat` forwarder from
loopback port 80 to the VM's ingress, and leave it running in its own terminal:

```bash
sudo apt-get install -y socat   # or: sudo snap install socat
sudo socat TCP-LISTEN:80,fork,reuseaddr TCP:<VM_IP>:80
```

nginx routes by `Host` header, and this plain TCP forward preserves it, so the one
forwarder serves both `athena.localhost` and `dex.localhost`. No `/etc/hosts` entry
is needed — the `.localhost` names already resolve to loopback, which is exactly
where `socat` is now listening.

Sanity-check before opening a browser:

```bash
curl -sSI http://athena.localhost/                       # 200 from Express
curl -sSI http://athena.localhost/assets/ -o /dev/null    # assets route at root
```

**c. Open the app.** Browse to `http://athena.localhost`.

Log in with the Dex dev credentials from [dex.yaml](./dex.yaml):

- **Email:** `dev.user@canonical.com`
- **Password:** `password`

## Teardown

```bash
# Inside the VM:
juju destroy-model athena --destroy-storage --no-prompt
microk8s kubectl delete -f charm/tests/manual/dex.yaml

# (on the host):
multipass delete athena && multipass purge
```

## Troubleshooting

- **OIDC "fetch failed":** the pod cannot resolve `dex.localhost`. Recheck the
  CoreDNS `hosts` block (step 11) and confirm `NODE_IP` is the current node IP.
- **App stuck blocked:** confirm PostgreSQL is integrated and all three secrets are
  granted and configured (`juju status --relations`, `juju show-secret ...`).
- **`curl athena.localhost` hits `127.0.0.1` and fails / `/etc/hosts` is ignored:**
  this is expected — `*.localhost` always resolves to loopback (step 12). Start the
  loopback `socat` forwarder; do not try to map the name to the VM IP in
  `/etc/hosts`. Confirm the forwarder is up with `ss -tlnp | grep ':80'`. To test
  the VM path independently, force resolution:
  `curl --resolve athena.localhost:80:<VM_IP> http://athena.localhost/`.
- **Page loads but assets/login 404 (served under `/athena-athena/`):** the
  `nginx-ingress-integrator` publishes the app under a `/<model>-<app>` prefix,
  which breaks the root-anchored frontend and OIDC callback. Apply the `athena-root`
  Ingress from step 9. Verify with `microk8s kubectl -n athena get ingress`.
- **Ingress unreachable after a VM reboot:** run `microk8s stop && microk8s start`,
  then restart CoreDNS. The ingress hostPort uses iptables DNAT, so nothing listens
  on `127.0.0.1:80` inside the VM — always target the node IP.
- **Image not refreshed on redeploy:** [pack-and-deploy.sh](./pack-and-deploy.sh)
  tags each build uniquely, so re-run it to force a fresh pull.
