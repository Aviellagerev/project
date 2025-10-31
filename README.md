Real-Time Shared Folder Application

A modern, secure, and real-time file sharing web application built with Flask. This project provides a platform for users to upload, download, and manage files with a granular, role-based permission system. All file additions and deletions are reflected instantly for all connected users without needing to refresh the page, thanks to Server-Sent Events (SSE).

This application is built using the Flask application factory pattern for better structure and scalability.

✨ Features

Secure User Authentication: Users can register and log in to a secure session.

Role-Based Permissions: A hierarchical permission system (Read, Write, Delete, Admin) controls user actions.

Real-Time Updates: Uses Server-Sent Events (SSE) to instantly update all connected clients when files are uploaded or deleted.

File Management: Users with appropriate permissions can upload, download, and delete files.

Drag & Drop Uploads: A fluid and intuitive drag-and-drop interface for uploading files.

Admin Panel: A dedicated, secure interface for administrators to manage users, change permissions, and delete accounts.

Modern & Responsive Design: A clean, professional, and mobile-friendly UI.

🛠️ Tech Stack

Backend: Flask, Gunicorn

Frontend: Vanilla JavaScript, HTML5, CSS3

Database: SQLite

Real-Time: Server-Sent Events (SSE) with gevent workers

Production Server: Ubuntu (Oracle Cloud)

Reverse Proxy: Nginx

1. Getting Started (Local Development)

Follow these instructions to get a local copy up and running for development.

Clone the repository:

git clone <your-repository-url>
cd project-folder


Create a virtual environment:

python3 -m venv venv


Activate the environment:

source venv/bin/activate


Install the required packages:
(Make sure gunicorn and gevent are in your requirements.txt)

pip install -r requirements.txt


Set a development secret key:

export SECRET_KEY='some-random-string-for-local-dev'


Run the application (in debug mode):
For local development, you can temporarily set debug=True in run.py to get error messages.

python3 run.py


The application will start on http://127.0.0.1:8000.

2. Production Deployment (Ubuntu/Oracle Cloud)

This is a comprehensive guide to deploying the application securely in a production environment.

A. Initial Server Setup (One-Time)

Install Essential Packages:

sudo apt update
sudo apt install python3-full nginx python3-certbot-nginx iptables-persistent -y


Configure Firewalls (Oracle Cloud):

Cloud Console: In your Oracle Cloud VCN Security List, add Ingress Rules to ALLOW TCP traffic on ports 80 and 443 from source 0.0.0.0/0.

Server Firewall (iptables): Open the ports on the server itself and make the rules permanent.

sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save


B. Application Setup

Clone & Set Up venv:

git clone <your-repository-url>
cd project-folder
python3 -m venv venv
source venv/bin/activate


Install Dependencies:

pip install -r requirements.txt


C. Security Configuration (CRITICAL)

Turn Off Debug Mode: In run.py, ensure it is set to debug=False.

Change Default Admin: In back/database.py, change the default admin:admin credentials to a new username and a strong, hashed password.

Use Static SECRET_KEY: In back/config.py, ensure the SECRET_KEY is set to read from an environment variable: SECRET_KEY = os.environ.get('SECRET_KEY').

Delete the Old DB: Delete the development database so it can be re-initialized with your new admin user.

rm instance/users.db


D. Nginx Configuration

Create Nginx Config File:

sudo nano /etc/nginx/sites-available/project-share


Paste this configuration. It includes the critical fix for your real-time SSE stream.

server {
    listen 80;
    server_name YOUR_SERVER_IP_OR_DOMAIN; # e.g., 158.178.129.52

    # Standard location for the main application
    location / {
        proxy_pass [http://127.0.0.1:8000](http://127.0.0.1:8000);
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Special location for Server-Sent Events (SSE)
    location /events/ {
        proxy_pass [http://127.0.0.1:8000/events/](http://127.0.0.1:8000/events/);
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }
}


Enable the Config:

sudo ln -s /etc/nginx/sites-available/project-share /etc/nginx/sites-enabled/
sudo nginx -t 
sudo systemctl restart nginx


E. Secure with HTTPS (Optional, but Recommended)

Run Certbot: (This only works if you are using a domain name, not an IP).

sudo certbot --nginx -d YOUR_SERVER_DOMAIN


Follow the prompts and select the "Redirect" option to force all traffic to https://.

3. How to Run the Production Server

Follow these steps to start your application.

To Start the App:

Activate venv:

cd ~/project
source venv/bin/activate


Set Secret Key:

export SECRET_KEY='PASTE_YOUR_PRODUCTION_SECRET_KEY_HERE'


Run Gunicorn:
This command starts your app in the background using the correct gevent workers for real-time.

nohup venv/bin/gunicorn -k gevent -w 4 -b 127.0.0.1:8000 'back:create_app()' &


Start Nginx (if not running):

sudo systemctl start nginx


Your app is now live at http://YOUR_SERVER_IP_OR_DOMAIN.

To Stop the App:

You can stop your app (Gunicorn) or the entire website (Nginx).

To Stop ONLY Your App (Gunicorn):

pkill gunicorn


To Stop the ENTIRE Website (Nginx):

sudo systemctl stop nginx