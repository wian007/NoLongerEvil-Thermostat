# Nest Thermostat Firmware Setup

> **⚠️ WARNING: EXPERIMENTAL SOFTWARE**
>
> This project is currently in the **experimental/testing phase**. Do NOT use this firmware on any thermostat that is critical for your heating or cooling needs. Flashing this firmware may brick your device or cause unexpected behavior. Only proceed if you have a backup thermostat or can afford to have your device non-functional during testing.

## Overview

This firmware loader uses the OMAP bootloader interface to flash custom bootloader and kernel images to Nest Thermostat devices. The device must be put into DFU mode to accept new firmware.

**Important:** After flashing this firmware, your device will no longer contact Nest/Google servers. It will operate independently and connect to the NoLongerEvil platform instead, giving you complete control over your thermostat.

## How it Works

The custom firmware flashes the device with modified bootloader and kernel components that redirect all network traffic from the original Nest/Google servers to a server we specify. This server hosts a reverse-engineered replica of their API, allowing the thermostat to function independently while giving you complete control over your device data and settings.

By intercepting the communication layer, the thermostat believes it's communicating with the official Nest infrastructure, but instead connects to the NoLongerEvil platform. This approach ensures full compatibility with the device's existing software while breaking free from Google's cloud dependency.

## Self-Hosting Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/codykociemba/NoLongerEvil-Thermostat.git
cd NoLongerEvil-Thermostat
```

### Step 2: Install Prerequisites

#### Linux (Debian/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install build-essential libusb-1.0-0-dev gcc pkg-config docker docker-compose
```

#### macOS

```bash
xcode-select --install
brew install libusb pkg-config docker docker-compose
```

### Step 3: Build and Flash Firmware

Run the installation script to build and flash the custom firmware:

```bash
chmod +x install.sh
./install.sh
```

This will:

- Prompt you for your API server URL
- Build the firmware with Docker
- Launch the Electron installer app
- Guide you through flashing your Nest device

### Step 4: Set Up Self-Hosted Convex

Download and run Convex with Docker Compose:

```bash
curl -O https://raw.githubusercontent.com/get-convex/convex-backend/refs/heads/main/self-hosted/docker/docker-compose.yml
docker compose up -d
docker compose exec backend ./generate_admin_key.sh
```

Save the admin key that is generated.
It will look like:

```
Admin key:
convex-self-hosted|01949bdf5627839049029834...
```

### Step 5: Configure Environment Variables

Both Convex and the NoLongerEvil application expect environment vars at `.env.local` instead of the traditional `.env`

**Server** (`server/.env.local`):

```bash
CONVEX_URL=http://localhost:3210
CONVEX_ADMIN_KEY=<admin-key-from-step-4>
```

### Step 6: Deploy Convex Schema

This takes the "table" schema of the app and deploys it into Convex.

```bash
cd server
npm install
npx convex dev
```

When this step is done you can Ctrl+C to end the terminal

### Step 7: Run Backend and Frontend

**Development:**
Run these in two separate terminals

```bash
# Terminal 1 - API Server
cd server
npm install
npm run dev:ts

# Terminal 2 - Web Dashboard
cd frontend
npm install
npm run dev
```

**Production:**

```bash
cd server
npm install
npm run build

cd ../frontend
npm install
npm run build

npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Visit `http://localhost:3000` to access the dashboard.

## What Gets Flashed

The firmware installation process installs three components:

1. **x-load.bin** - First-stage bootloader (X-Loader for OMAP)
2. **u-boot.bin** - Second-stage bootloader (Das U-Boot) loaded at address 0x80100000
3. **uImage** - Linux kernel image loaded at address 0x80A00000

After flashing, the device jumps to execution at 0x80100000 (u-boot).

## Security Considerations

This tool provides low-level access to the device's boot process. Use responsibly:

- Only use on devices you own
- Improper firmware can brick your device (Don't sue me bro)

## Credits & Acknowledgments

This project builds upon the excellent work of several security researchers and developers:

- **[grant-h](https://github.com/grant-h) / [ajb142](https://github.com/ajb142)** - [omap_loader](https://github.com/ajb142/omap_loader), the USB bootloader tool used to flash OMAP devices
- **[exploiteers (GTVHacker)](https://github.com/exploiteers)** - Original research and development of the [Nest DFU attack](https://github.com/exploiteers/NestDFUAttack), which demonstrated the ability to flash custom firmware to Nest devices gen 1 & gen 2
- **[FULU](https://bounties.fulu.org/)** and all bounty backers - For funding the [Nest Learning Thermostat Gen 1/2 bounty](https://bounties.fulu.org/bounties/nest-learning-thermostat-gen-1-2) and supporting the right-to-repair movement
- **[z3ugma](https://sett.homes)** - MQTT/Home Assistant integration support

Without their groundbreaking research, open-source contributions, and advocacy for device ownership rights, this work would not be possible. Thank you!

### Open Source Commitment

We are committed to transparency and the right-to-repair movement. This project is now fully open source, allowing the community to audit, improve, and self-host their own infrastructure.

## Support

This project is sponsored by and made by the team at:

<p align="center">
  <a href="https://hackhouse.io" target="_blank">
    <img src="assets/hh-logo.png" width="200" alt="Hack/House Logo" />
  </a>
</p>

## Stay in touch

- Author - [Cody Kociemba](https://www.linkedin.com/in/codykociemba/)
- Website - [https://nolongerevil.com](https://nolongerevil.com)
- Discord - [https://discord.gg/hackhouse](https://discord.com/invite/hackhouse)

## License

No Longer Evil is [MIT licensed](LICENSE).
