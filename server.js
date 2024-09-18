const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const moment = require("moment");
const authenticateToken = require("./middleware/authenticateToken");
const getOverlappingTimes = require("./middleware/timeUnion");
const transporter = require("./middleware/nodemailer");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: "",
  database: process.env.DATABASE,
  connectionLimit: 10,
});

const jwtSecret = process.env.JWT_SECRET;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.post("/register", (req, res) => {
  const { name, email, password, preferred_language } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required" });
  }

  pool.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).send("Server error");
    }

    if (results.length > 0) {
      return res.status(400).json({ error: "Email is already in use" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    pool.query(
      "INSERT INTO users (name, email, password, preferred_language) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, preferred_language],
      (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).send("Server error");
        }

        res.status(201).send("User registered successfully");
      }
    );
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  pool.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ error: "There was an error with logging in" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = results[0];

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, {
      expiresIn: "24h",
    });

    res
      .status(200)
      .json({ message: "Login successful", token, userId: user.id });
  });
});

app.post("/logout", (req, res) => {
  res.cookie("authToken", "", { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ message: "Logged out successfully" });
});

app.get("/user-emails", (req, res) => {
  pool.query("SELECT email FROM users", (error, results) => {
    if (error) {
      return res
        .status(500)
        .json({ error: "There was an error fetching emails" });
    }
    const emails = results.map((row) => row.email);
    res.json(emails);
  });
});

app.post("/user-availabilities", (req, res) => {
  const emailsArray = Object.values(req.body);

  if (!emailsArray || !Array.isArray(emailsArray)) {
    return res
      .status(400)
      .json({ error: "Emails are required and must be an array" });
  }

  pool.query(
    "SELECT id FROM users WHERE email IN (?)",
    [emailsArray],
    (error, userResults) => {
      if (error) {
        return res.status(500).json({
          error: "Error fetching user IDs from emails",
        });
      }

      const userIds = userResults.map((row) => row.id);

      if (userIds.length === 0) {
        return res
          .status(404)
          .json({ message: "No users found for the given emails" });
      }

      pool.query(
        "SELECT user_id, availability_data FROM availability WHERE user_id IN (?)",
        [userIds],
        (error, availabilityResults) => {
          if (error) {
            return res
              .status(500)
              .json({ error: "There was an error fetching availabilities" });
          }

          const availabilities = availabilityResults.map((row) =>
            JSON.parse(row.availability_data)
          );

          const combinedAvailability = availabilities.reduce((acc, avail) => {
            for (const day of Object.keys(avail)) {
              if (!acc[day]) {
                acc[day] = avail[day];
              } else {
                acc[day] = getOverlappingTimes(
                  { [day]: acc[day] },
                  { [day]: avail[day] }
                )[day];
              }
            }
            return acc;
          }, {});

          res.json(combinedAvailability);
        }
      );
    }
  );
});

app.get("/user/:id", (req, res) => {
  const userId = req.params.id;
  pool.query("SELECT * FROM users WHERE id = ?", [userId], (error, results) => {
    if (error) {
      return res
        .status(500)
        .json({ error: "There was an error fetching user data" });
    }
    res.status(200).json(results);
  });
});

app.get("/users/:id/availability", (req, res) => {
  const userId = req.params.id;

  pool.query(
    "SELECT availability_data FROM availability WHERE user_id = ?",
    [userId],
    (error, results) => {
      if (error) {
        return res
          .status(500)
          .json({ error: "There was an error fetching availability" });
      }
      res.status(200).json(JSON.parse(results[0].availability_data));
    }
  );
});

app.put("/users/:id/availability", (req, res) => {
  const userId = req.params.id;
  const newAvailability = req.body;

  if (!newAvailability || typeof newAvailability !== "object") {
    return res.status(400).json({ error: "Invalid availability data" });
  }

  pool.query(
    "UPDATE availability SET availability_data = ? WHERE user_id = ?",
    [JSON.stringify(newAvailability), userId],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: "Server error" });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json(results);
    }
  );
});

app.get("/appointments", authenticateToken, (req, res) => {
  const userId = req.user.id;

  pool.query(
    "SELECT email FROM users WHERE id = ?",
    [userId],
    (error, results) => {
      if (error) return res.status(500).send("Error fetching user email");

      const userEmail = results[0]?.email;

      if (!userEmail) {
        return res.status(404).send("User email not found");
      }

      pool.query(
        "SELECT * FROM appointments WHERE JSON_CONTAINS(guests, JSON_QUOTE(?))",
        [userEmail],
        (error, results) => {
          if (error) return res.status(500).send("Error fetching appointments");

          res.status(200).json(results);
        }
      );
    }
  );
});

app.post("/appointments", authenticateToken, (req, res) => {
  const {
    title,
    start,
    end,
    location,
    guests,
    description,
    userId,
    sendNotification,
  } = req.body;

  pool.query(
    "INSERT INTO appointments (user_id, title, start, end, location, guests, description, send_notification ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      title,
      start,
      end,
      location,
      guests,
      description,
      sendNotification,
    ],
    (error, result) => {
      if (error) return res.status(500).send("Server error");

      if (sendNotification) {
        const guestList = JSON.parse(guests);
        const formattedStart = moment(start).format(
          "dddd, MMMM D, YYYY, HH:mm"
        );
        const formattedEnd = moment(end).format("HH:mm");

        guestList.forEach((email) => {
          const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: `Poziv na sastanak: ${title} @ ${formattedStart} - ${formattedEnd}`,
            html: `<table cellpadding="0" cellspacing="0" border="0" style="
    border: 1px solid #e5e5e5;
    min-width: 624px;
    table-layout: fixed;
    width: 100%;
    border-collapse: collapse;
    font-family: Helvetica;
">
  <tbody>
    <tr>
      <td style="
          background-color: #f6f6f6;
          border: 1px solid #e5e5e5;
          padding: 21px;
          vertical-align: top;
          width: 100%;
          max-width: 315px;
          display: block;
      ">
        <div style="
            background: url('https://odseknis.akademijanis.edu.rs/wp-content/uploads/2020/03/Logo-akademije-Nis-2020-e1583448050322.png') no-repeat center center;
            height: 80px;
            width: 100%;
            display: block;
        "></div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="
          width: 100%;
          padding: 21px;
          vertical-align: top;
      ">
        <table cellpadding="0" cellspacing="0" border="0" style="
            width: 100%;
            border-collapse: collapse;
            display: block;
        ">
          <tbody>
          <tr style="display: table-row; margin: 0 0 20px 0;">
          <td style="
             color: #222;
             font-size: 24px;
            padding: 0 0 20px 0;
             text-transform: capitalize;
             ">${title}</td>
          </tr>
            <tr style="display: table-row;">
              <td style="
                  padding-right: 10px;
                  min-width: 48px;
                  white-space: nowrap;
                  padding-bottom: 6px;
                  color: #999;
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
              ">Kada</td>
              <td style="
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
              ">${formattedStart} – ${formattedEnd}</td>
            </tr>
            <tr style="display: table-row;">
              <td style="
                  padding-right: 10px;
                  min-width: 48px;
                  white-space: nowrap;
                  padding-bottom: 6px;
                  color: #999;
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
              ">Ko</td>
              <td style="
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
                  word-spacing: 5px;
              ">${guestList}</td>
            </tr>
            <tr style="display: table-row;">
               <td style="
                  padding-right: 10px;
                  min-width: 48px;
                  white-space: nowrap;
                  padding-bottom: 6px;
                  color: #999;
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
              ">Gde</td>
              <td style="
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
              ">${location}</td>
            </tr>
            <tr style="display: table-row;">
               <td style="
                  padding-right: 10px;
                  min-width: 48px;
                  white-space: nowrap;
                  padding-bottom: 6px;
                  color: #999;
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
              ">Opis</td>
              <td style="
                  padding-left: 0;
                  padding-top: 2px;
                  vertical-align: top;
                  word-wrap: break-word;
              ">${description}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
`,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error(`Failed to send email to ${email}:`, error);
            }
          });
        });
      }

      res.status(201).json({
        userId,
        title,
        start,
        end,
        location,
        guests,
        description,
      });
    }
  );
});

app.get("/appointments/:id", authenticateToken, (req, res) => {
  const appointmentId = req.params.id;

  pool.query(
    "SELECT * FROM appointments WHERE id = ?",
    [appointmentId],
    (error, results) => {
      if (error) {
        return res
          .status(500)
          .json({ error: "There was an error fetching the meeting" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      res.status(200).json(results[0]);
    }
  );
});

app.put("/appointments/:id", authenticateToken, (req, res) => {
  const appointmentId = req.params.id;
  const { title, start, end, location, guests, description, sendNotification } =
    req.body;
  const userId = req.user.id;
  const guestsArray = Array.isArray(guests) ? guests : JSON.parse(guests);

  pool.query(
    "UPDATE appointments SET title = ?, start = ?, end = ?, location = ?, guests = ?, description = ?, send_notification = ? WHERE id = ? AND user_id = ?",
    [
      title,
      start,
      end,
      location,
      JSON.stringify(guestsArray),
      description,
      sendNotification,
      appointmentId,
      userId,
    ],
    (error, result) => {
      if (error)
        return res.status(500).send("There was an error updating the meeting");

      if (sendNotification) {
        const guestList = JSON.parse(guests);
        const formattedStart = moment(start).format(
          "dddd, MMMM D, YYYY, HH:mm"
        );
        const formattedEnd = moment(end).format("HH:mm");

        guestList.forEach((email) => {
          const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: `Ažuriranje sastanka: ${title} @ ${formattedStart} - ${formattedEnd}`,
            html: `<table cellpadding="0" cellspacing="0" border="0" style="
            border: 1px solid #e5e5e5;
            min-width: 624px;
            table-layout: fixed;
            width: 100%;
            border-collapse: collapse;
            font-family: Helvetica;
        ">
          <tbody>
            <tr>
              <td style="
                  background-color: #f6f6f6;
                  border: 1px solid #e5e5e5;
                  padding: 21px;
                  vertical-align: top;
                  width: 100%;
                  max-width: 315px;
                  display: block;
              ">
                <div style="
                    background: url('https://odseknis.akademijanis.edu.rs/wp-content/uploads/2020/03/Logo-akademije-Nis-2020-e1583448050322.png') no-repeat center center;
                    height: 80px;
                    width: 100%;
                    display: block;
                "></div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="
                  width: 100%;
                  padding: 21px;
                  vertical-align: top;
              ">
                <table cellpadding="0" cellspacing="0" border="0" style="
                    width: 100%;
                    border-collapse: collapse;
                    display: block;
                ">
                  <tbody>
                   <tr style="display: table-row; margin: 0 0 20px 0;">
          <td style="
             color: #222;
             font-size: 24px;
            padding: 0 0 20px 0;
             text-transform: capitalize;
             ">${title}</td>
          </tr>
                    <tr style="display: table-row;">
                      <td style="
                          padding-right: 10px;
                          min-width: 48px;
                          white-space: nowrap;
                          padding-bottom: 6px;
                          color: #999;
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                      ">Kada</td>
                      <td style="
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                      ">${formattedStart} – ${formattedEnd}</td>
                    </tr>
                    <tr style="display: table-row;">
                      <td style="
                          padding-right: 10px;
                          min-width: 48px;
                          white-space: nowrap;
                          padding-bottom: 6px;
                          color: #999;
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                      ">Ko</td>
                      <td style="
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                          word-spacing: 5px;
                      ">${guestList}</td>
                    </tr>
                    <tr style="display: table-row;">
                       <td style="
                          padding-right: 10px;
                          min-width: 48px;
                          white-space: nowrap;
                          padding-bottom: 6px;
                          color: #999;
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                      ">Gde</td>
                      <td style="
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                      ">${location}</td>
                    </tr>
                    <tr style="display: table-row;">
                       <td style="
                          padding-right: 10px;
                          min-width: 48px;
                          white-space: nowrap;
                          padding-bottom: 6px;
                          color: #999;
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                      ">Opis</td>
                      <td style="
                          padding-left: 0;
                          padding-top: 2px;
                          vertical-align: top;
                          word-wrap: break-word;
                      ">${description}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        `,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error(`Failed to send email to ${email}:`, error);
            }
          });
        });
      }

      res.status(200).send("Meeting updated successfully");
    }
  );
});

app.delete("/delete-appointments/:id", authenticateToken, (req, res) => {
  const appointmentId = req.params.id;

  pool.query(
    "SELECT * FROM appointments WHERE id = ?",
    [appointmentId],
    (error, results) => {
      if (error) {
        return res
          .status(500)
          .json({ error: "There was an error fetching the meeting details" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const meeting = results[0];
      const { title, start, end, location, guests, description } = meeting;
      const guestList = JSON.parse(guests);
      const formattedStart = moment(start).format("dddd, MMMM D, YYYY, HH:mm");
      const monthString = moment(start).format("MMMM");
      const dayNumber = moment(start).format("D");
      const dayString = moment(start).format("dddd");
      const formattedEnd = moment(end).format("HH:mm");

      pool.query(
        "DELETE FROM appointments WHERE id = ?",
        [appointmentId],
        (error, result) => {
          if (error) {
            return res
              .status(500)
              .json({ error: "There was an error deleting the meeting" });
          }
          if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Meeting not found" });
          }

          guestList.forEach((email) => {
            const mailOptions = {
              from: process.env.EMAIL,
              to: email,
              subject: `Otkazan je sastanak: ${title} @ ${formattedStart} - ${formattedEnd}`,
              html: `<table cellpadding="0" cellspacing="0" border="0" style="
              border: 1px solid #e5e5e5;
              min-width: 624px;
              table-layout: fixed;
              width: 100%;
              border-collapse: collapse;
              font-family: Helvetica;
          ">
            <tbody>
              <tr>
                <td style="
                    background-color: #f6f6f6;
                    border: 1px solid #e5e5e5;
                    padding: 21px;
                    vertical-align: top;
                    width: 100%;
                    max-width: 315px;
                    display: block;
                ">
                  <div style="
                      background: url('https://odseknis.akademijanis.edu.rs/wp-content/uploads/2020/03/Logo-akademije-Nis-2020-e1583448050322.png') no-repeat center center;
                      height: 80px;
                      width: 100%;
                      display: block;
                  "></div>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="
                    width: 100%;
                    padding: 21px;
                    vertical-align: top;
                ">
                  <table cellpadding="0" cellspacing="0" border="0" style="
                      width: 100%;
                      border-collapse: collapse;
                      display: block;
                  ">
                    <tbody>
                     <tr style="display: table-row;">
          <td style="
             color: #222;
             font-size: 24px;
             text-transform: capitalize;
            text-decoration: line-through;
              padding: 0 0 20px 0;
             ">${title}</td>
          </tr>
                      <tr style="display: table-row;">
                        <td style="
                            padding-right: 10px;
                            min-width: 48px;
                            white-space: nowrap;
                            padding-bottom: 6px;
                            color: #999;
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                            word-wrap: break-word;
                        ">Kada</td>
                        <td style="
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                            word-wrap: break-word;
                             text-decoration: line-through;
                        ">${formattedStart} – ${formattedEnd}</td>
                      </tr>
                      <tr style="display: table-row;">
                        <td style="
                            padding-right: 10px;
                            min-width: 48px;
                            white-space: nowrap;
                            padding-bottom: 6px;
                            color: #999;
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                            word-wrap: break-word;
                        ">Ko</td>
                        <td style="
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                            word-wrap: break-word;
                            word-spacing: 5px;
                             text-decoration: line-through;
                        ">${guestList}</td>
                      </tr>
                      <tr style="display: table-row;">
                         <td style="
                            padding-right: 10px;
                            min-width: 48px;
                            white-space: nowrap;
                            padding-bottom: 6px;
                            color: #999;
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                            word-wrap: break-word;
                        ">Gde</td>
                        <td style="
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                            word-wrap: break-word;
                             text-decoration: line-through;
                        ">${location}</td>
                      </tr>
                      <tr style="display: table-row;">
                         <td style="
                            padding-right: 10px;
                            min-width: 48px;
                            white-space: nowrap;
                            padding-bottom: 6px;
                            color: #999;
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                            word-wrap: break-word;
                        ">Opis</td>
                        <td style="
                            padding-left: 0;
                            padding-top: 2px;
                            vertical-align: top;
                             text-decoration: line-through;
                            word-wrap: break-word;
                        ">${description}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
          `,
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error(`Failed to send email to ${email}:`, error);
              }
            });
          });

          res.status(200).json({
            message: "Meeting deleted and notifications sent successfully",
          });
        }
      );
    }
  );
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
