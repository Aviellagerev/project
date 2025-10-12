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

📂 Project Structure
The project is organized using the Flask application factory pattern for better structure, scalability, and maintainability.

project-login/
│
├── run.py              # The main script to start the application server.
├── requirements.txt    # Lists the required Python packages.
├── .gitignore          # Specifies files and folders for Git to ignore.
│
└── back/               # The core Flask application package.
    │
    ├── __init__.py     # Initializes the Flask app and registers blueprints.
    │
    ├── static/         # Contains all static files (CSS, JavaScript).
    │   ├── css/
    │   │   ├── styles.css  # Main stylesheet for the application.
    │   │   └── admin.css   # Styles specific to the admin panel.
    │   └── js/
    │       ├── script.js   # Client-side logic for the main file manager.
    │       └── admin.js    # Client-side logic for the admin panel.
    │
    ├── templates/      # Contains all HTML templates.
    │   ├── index.html    # A single template for both login and the file manager.
    │   └── admin.html    # The template for the user management panel.
    │
    ├── auth.py         # Handles user authentication, registration, and sessions.
    ├── files.py        # Manages all file-related actions (upload, download, delete).
    ├── admin.py        # Contains the routes and logic for the admin panel.
    ├── events.py       # Manages the Server-Sent Events (SSE) stream for real-time updates.
    ├── database.py     # Handles database connection, initialization, and teardown.
    ├── config.py       # Stores configuration variables for the application.
    ├── models.py       # (Optional) Can be used to define data models.
    ├── schema.sql      # The SQL schema for creating the database tables.
    └── utils.py        # Contains helper and utility functions.

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
