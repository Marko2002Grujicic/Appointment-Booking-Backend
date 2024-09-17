# Table of Contents

1. **Requirements**
2. **Installation**
3. **Configuration**
4. **Running the Project**
5. **API Endpoints**
6. **Email Notifications**
7. **Database Structure**
8. **Error Handling**

# Requirements

-Node.js (v14.x or above)
-MySQL Database
-Nodemailer (for email notifications)
-dotenv (for environment variables)
-nodemailer (for sending email notifications)

## Installation

In terminal use following commands:

1. Clone Frontend Repository:
   `git clone https://github.com/Marko2002Grujicic/Appointment-Booking`

2. Clone Backend repository in a new folder
   `git clone https://github.com/Marko2002Grujicic/Appointment-Booking-Backend`

3. Install Dependecies in both projects:
   `npm install`

4. Start database using XAAMP.
   `Run Apache and MySQL`

5. Run the development servers:
   Frontend - `npm start`

Backend - `nodemon server.js`

6. Open the app in your browser:

`http://localhost:3000/`

## Configuration

Database: Set up a MySQL database and create the necessary tables for the appointments.

Environment Variables: Create a .env file in the root of the project to configure the required environment variables.

Example `.env`
`

# Database configuration

DB_HOST,
DB_USER,
DB_PASSWORD,
DB_NAME,

# Nodemailer email configuration

EMAIL=your-email@example.com
EMAIL_PASSWORD=your-email-password

# JWT secret

JWT_SECRET=your_jwt_secret
`

## API Endpoints

# Authentication

POST /login: Logs a user in and returns a JWT token.
POST /register: Registers a new user.

# Appointments

GET /appointments/:id: Fetch details of an appointment by its ID.
PUT /appointments/:id: Update an appointment.
DELETE /delete-appointments/:id: Delete an appointment and notify guests via email.

# Availability

GET /user-availability Fetch availabilities of all users selected in the
GET /users/:id/availability fetch availability for specific user
PUT /users/:id/availability updates the availability for specific user

## Sending Email Notifications

- Meeting Canceled Notification: Sent when a meeting is deleted.
- Meeting Update Notification: Sent when a meeting is updated.
- Meeting Update Notification: Sent when a meeting is created.

# Sending Emails

- To send HTML-formatted emails, Nodemailer is used. The email template includes dynamic information about the appointment such as the title, start and end times, location, and more. Image is used for the logo.

## Database Structure

# appointments

- `id`: Appointment ID
- `user_id`: ID of the user who created the appointment
- `title`: Title of the appointment
- `start`: Start date and time
- `end`: End date and time
- `location`: Location of the appointment
- `guests`: JSON array of guest emails
- `description`: Description of the meeting
- `send_notification`: Boolean to indicate if guests should be notified

# users

- `id`: User ID
- `name`: User name
- `email`: User email
- `password`: User password
- `preferred_language`: Preferred user language

# availability

- `id`: Availability ID
- `user_id`: ID of the user who availability belongs to
- `availability_data`: Availability Data in JSON

## Error Handling

All API requests return appropriate HTTP status codes and error messages:

- 500: Internal Server Error
- 404: Not Found (for non-existent resources like appointments)
- 401: Unauthorized (for authentication-related issues)
