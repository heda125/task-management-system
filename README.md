# TaskFlow — Task Management System

A web-based **Task Management System (To-Do List Application)** that helps users
organize, track, and manage their daily tasks efficiently.

This project was developed as part of the **Software Engineering** course at
**Al-Aqsa University — Faculty of Computers and Information Technology**.

---

## 📌 Overview

TaskFlow allows users to create and manage daily tasks, categorize and prioritize
them, track their progress, and mark them as completed. It includes a full
authentication system and an administrator dashboard for managing users and
categories.

The application is built with **pure HTML, CSS, and JavaScript** and uses the
browser's **localStorage** to simulate a database (matching the ER model designed
in the SRS document).

---

## ✨ Features

### User Features
- Register a new account and log in securely
- Reset password
- Add, edit, and delete tasks
- Mark tasks as completed
- Categorize tasks (Study, Work, Personal, General)
- Set task priority (High, Medium, Low)
- Filter tasks (All / Active / Completed)
- Search tasks by keyword
- Visual progress bar showing completion percentage

### Admin Features
- Manage user accounts (view, activate, deactivate, delete)
- Manage task categories (add, edit, delete)
- Monitor system activity
- Generate reports and statistics

---

## 🛠️ Technologies Used

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6) |
| Data Storage | Browser localStorage (database simulation) |
| Security | SHA-256 password hashing (Web Crypto API) |
| Fonts | Google Fonts (Tajawal) |

---

## 🔐 Security

- Passwords are **never stored in plain text**.
- All passwords are hashed using **SHA-256** via the Web Crypto API before storage.
- Each user can only access their own tasks (data isolation).

---

## 🗂️ Project Structure

```
task-management-system/
├── index.html      # Page structure (Presentation)
├── style.css       # Styling and responsive design
├── script.js       # Application logic (Auth, Tasks, Admin)
└── README.md       # Project documentation
```

---

## 🚀 How to Run

1. Download or clone the repository:
   ```
   git clone https://github.com/heda125/task-management-system.git
   ```
2. Make sure the three files (`index.html`, `style.css`, `script.js`) are in the
   **same folder**.
3. Open **`index.html`** in any modern web browser.

No server or installation is required.

---

## 👤 Default Admin Account

| Field | Value |
|-------|-------|
| Email | `admin@taskflow.com` |
| Password | `admin123` |

You can also register a new regular user account from the login screen.

---

## 📱 Responsive Design

The interface is fully responsive and adapts to:
- 💻 Desktop / Laptop
- 📱 Tablet
- 📲 Mobile

---

## 📄 Related Documentation

This implementation is based on the **Software Requirements Specification (SRS)**
prepared in Part 2 of the project, covering the functional requirements (FR-1 to
FR-17), non-functional requirements (NFR-1 to NFR-8), use cases, and system design
models (Use Case, Activity, Class, and ER diagrams).

---

## 👩‍💻 Author

**Heba Al-Daya**
Software Engineering — Al-Aqsa University
Instructor: Eng. Firas Fouad Al-ijla
