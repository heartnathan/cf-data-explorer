# CF Data Explorer

![Logo](./public/favicon.png)

English | [简体中文](./README.md)

A modern, pure-frontend Cloudflare data management dashboard that allows you to securely connect to and manage your Cloudflare assets directly via API Key, without needing to log into the official dashboard.

## Core Features

- **📦 R2 Object Storage Management**
  - Supports true sub-directory structure browsing.
  - Perfectly handles automatic long-tail pagination for massive directories, eliminating loading lag.
  - Supports lightning-fast file uploads and batch deletions.
- **📊 D1 Database Management**
  - WYSIWYG database schema parsing and real-time browsing.
  - Supports table-based CRUD operations (provides single-row, fine-grained `Copy` capabilities similar to native SQL to assist with fast data entry).
  - Built-in dynamic table pagination retrieval based on `LIMIT/OFFSET`.
  - Built-in SQL editing console, allowing you to execute raw `Query` at will.
  - One-click export of retrieved table results as `.csv` files.
- **🔑 KV Key-Value Management**
  - Supports intuitive full-scale read/write and CRUD operations for key-value pairs.

---

## 🚀 Deployment Guide

This project is built with Vue 3 + Vite. To bypass the browser's Cross-Origin Resource Sharing (CORS) restrictions and API security authentication probing, this project **requires a server-side component of any form to forward requests** when making authentic calls to `https://api.cloudflare.com`.

Depending on your infrastructure environment, please choose one of the following deployment methods:

### Deployment Option 1: Deploy to Cloudflare Network (Recommended)

Go to the Cloudflare official website and follow the steps in the screenshot:

1. Find and click on **Workers & Pages** in the left sidebar panel.
2. Click the **Create application** button on the right side of the page.
3. In the "Ship something new" section, directly select **Continue with GitHub** or your other code repository platform to automatically pull and deploy this project with one click.

   <img src="https://dash.cloudflare.com/assets/components/github-icon.svg" width="300" alt="Connect Github">

4. Once successfully deployed, let the application take over your compiled project files and proxy logic, and you can enjoy the official global network acceleration.

### Deployment Option 2: Use Your Own Linux Server (Based on Nginx)

If your guidelines require running the frontend project on a private cloud (e.g., a configured CentOS server, Baota panel), please use Nginx's native foundation to intercept `/client/v4/` and set up a reverse proxy:

1. Compile the pure static frontend assets:
   ```bash
   yarn build
   ```
2. Upload the resulting `/dist` folder to the server (e.g., `/www/cf-explorer/dist`).
3. Configure the Nginx Server for that domain:

   ```nginx
   server {
       listen 80;
       server_name your-ip-or-domain.com;

       # Point to the static page resources
       root /www/cf-explorer/dist;
       index index.html;

       # Prevent Vue refresh from causing 404
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Core: Cross-origin API proxy
       location /client/v4/ {
           # Handle OPTIONS preflight requests
           if ($request_method = 'OPTIONS') {
               add_header 'Access-Control-Allow-Origin' '*';
               add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
               add_header 'Access-Control-Allow-Headers' 'Content-Type, X-Auth-Email, X-Auth-Key';
               return 204;
           }

           # Reverse proxy real traffic
           proxy_pass https://api.cloudflare.com/client/v4/;
           proxy_set_header Host api.cloudflare.com;
           proxy_ssl_server_name on;

           # Forcibly return CORS Headers
           add_header 'Access-Control-Allow-Origin' '*';
           add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
       }
   }
   ```

4. Execute `nginx -s reload`.

### Deployment Option 3: Deploy using a Lightweight Node.js Service

If your server cannot install Nginx but has a Node.js package environment, you only need two steps:

1. Create a lightweight `server.js` startup gateway service:

   ```js
   const express = require("express");
   const { createProxyMiddleware } = require("http-proxy-middleware");
   const path = require("path");
   const cors = require("cors");

   const app = express();
   app.use(
     cors({
       origin: "*",
       methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
       allowedHeaders: ["Content-Type", "X-Auth-Email", "X-Auth-Key"],
     }),
   );

   app.use(
     "/client/v4",
     createProxyMiddleware({
       target: "https://api.cloudflare.com",
       changeOrigin: true, // Enable SNI
     }),
   );

   app.use(express.static(path.join(__dirname, "dist")));
   app.get("*", (req, res) =>
     res.sendFile(path.join(__dirname, "dist/index.html")),
   );

   app.listen(3000, () => console.log("Server is running on port 3000"));
   ```

2. Use `pm2 start server.js` to run it persistently in the background.
