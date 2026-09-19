# Setup scripts

Two scripts to run on a fresh VPS — see `../self-hosted-setup-guide.md` for
full context, DNS records needed, and the deliverability warnings before
running `install-mailcow.sh` specifically.

These are not part of the Altegic app itself and are never deployed with
it — copy them to your VPS and run them there, not on the app's own
Railway service.

## Usage

```bash
# Copy to your VPS (from your own machine, not this app's server):
scp install-coolify.sh install-mailcow.sh root@<vps-ip>:/root/

# Then, on the VPS itself:
ssh root@<vps-ip>
chmod +x install-coolify.sh install-mailcow.sh
./install-coolify.sh   # for website hosting
./install-mailcow.sh   # for email hosting — read the DNS prerequisites
                        # in the guide FIRST, not after running this
```

Run them on separate VPS instances if your budget allows — see the guide's
"Part 1 — Get a VPS" section for why.
