Real-Time Shared Folder Application
A modern, secure, and real-time file sharing web application built with Flask. This project provides a platform for users to upload, download, and manage files with a granular, role-based permission system. All file additions and deletions are reflected instantly for all connected users without needing to refresh the page, thanks to Server-Sent Events (SSE).

✨ Features
Secure User Authentication: Users can register and log in to a secure session.

Role-Based Permissions: A hierarchical permission system (Read, Write, Delete, Admin) controls user actions.

Real-Time Updates: Uses Server-Sent Events (SSE) to instantly update all connected clients when files are uploaded or deleted.

File Management: Users with appropriate permissions can upload, download, and delete files.

Drag & Drop Uploads: A fluid and intuitive drag-and-drop interface for uploading files.

Admin Panel: A dedicated, secure interface for administrators to manage users, change permissions, and delete accounts.

Dynamic UI: The user interface dynamically adapts to a user's permissions, hiding or showing controls as needed.

Modern & Responsive Design: A clean, professional, and mobile-friendly UI built with modern CSS.

🛠️ Tech Stack
Backend: Flask

Database: SQLite

Frontend: Vanilla JavaScript, HTML5, CSS3

Real-Time Communication: Server-Sent Events (SSE)

Deployment: Can be deployed with any WSGI server like Gunicorn or Waitress.

📂 File Breakdown
The project is organized using the Flask application factory pattern for better structure and scalability. Here is a breakdown of the key files and their purpose:

Root Directory (project-login/)
run.py: The main entry point to start the Flask application server.

requirements.txt: Lists all the required Python packages for the project.

.gitignore: Specifies which files and directories should be ignored by Git version control.

Application Package (back/)
__init__.py: The heart of the application. It contains the application factory (create_app), initializes the Flask app, and registers all the different modules (blueprints).

config.py: Stores configuration variables, such as secret keys and database paths, for different environments (e.g., development, production).

database.py: Manages all database-related functions, including connecting to the database, closing the connection, and initializing the database with a default admin user.

schema.sql: Contains the SQL commands to create the users table schema from scratch.

auth.py: Handles all user authentication logic, including registration, login, logout, and session management. It also contains the permission decorators.

files.py: Manages all file-related actions, such as handling file uploads, serving downloads, and processing deletions.

admin.py: Contains all the routes and logic for the admin panel, including listing users and updating their permissions.

events.py: Manages the Server-Sent Events (SSE) stream, allowing the server to push real-time updates to connected clients.

utils.py: A collection of helper and utility functions used across the application, such as fetching the list of files.

Templates (back/templates/)
index.html: A single, dynamic Jinja2 template that serves as both the login/registration page for logged-out users and the main file manager interface for logged-in users.

admin.html: The template for the user management panel, accessible only to administrators.

Static Files (back/static/)
css/styles.css: The main stylesheet for the application's look and feel, including the login page and file manager.

css/admin.css: Styles specifically tailored for the admin panel to give it a distinct appearance.

js/script.js: Contains all the client-side JavaScript for the main application, handling UI interactions, file sorting, drag-and-drop, and real-time updates.

js/admin.js: Contains the client-side JavaScript for the admin panel, responsible for fetching users and handling real-time updates to the user list.

🚀 Getting Started
Follow these instructions to get a local copy up and running.

Prerequisites
Python 3.6+

pip package installer

Installation & Setup
Clone the repository:

git clone <your-repository-url>
cd project-login

Create a virtual environment:
It is highly recommended to use a virtual environment to manage dependencies.

python3 -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

Install the required packages:

pip install -r requirements.txt

Run the application:

python3 run.py

The application will start on http://0.0.0.0:8000. Open this URL in your web browser.

📝 Usage
Default Admin Account: When you first run the application, a default admin account is automatically created:

Registration: New users can register for an account. They will be granted Read permissions by default.

File Management: Log in to view, upload, or download files based on your assigned permissions.

Admin Panel: Log in as an admin and navigate to the /admin route to manage users.
