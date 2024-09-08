const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require("cors");
const authenticateToken = require("./middleware/authenticateToken");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "appointment_meetings",
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
  const { name, email, password } = req.body;

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
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword],
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
      return res.status(500).json({ error: "Server error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = results[0];

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
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

app.get("/user/:id", (req, res) => {
  const userId = req.params.id;
  pool.query("SELECT * FROM users WHERE id = ?", [userId], (error, results) => {
    if (error) {
      return res.status(500).json({ error: "Server error" });
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
        return res.status(500).json({ error: "Server error" });
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

app.get("/user-emails", (req, res) => {
  pool.query("SELECT email FROM users", (error, results) => {
    if (error) {
      return res.status(500).json({ error: "Server error" });
    }
    const emails = results.map((row) => row.email);
    res.json(emails);
  });
});

app.get("/meetings", authenticateToken, (req, res) => {
  const userId = req.user.id;

  pool.query(
    "SELECT * FROM meetings WHERE user_id = ?",
    [userId],
    (error, results) => {
      if (error) return res.status(500).send("Server Error");
      res.status(200).json(results);
    }
  );
});

app.post("/meetings", authenticateToken, (req, res) => {
  const { title, start, end, location, guests, description, userId } = req.body;

  console.log(req.body);

  pool.query(
    "INSERT INTO meetings (user_id, title, start, end, location, guests, description ) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, title, start, end, location, guests, description],
    (error, result) => {
      if (error) return res.status(500).send("Server error");
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

app.get("/meetings/:id", authenticateToken, (req, res) => {
  const meetingId = req.params.id;

  pool.query(
    "SELECT * FROM meetings WHERE id = ?",
    [meetingId],
    (error, results) => {
      if (error) {
        return res.status(500).json({ error: "Server error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      res.status(200).json(results[0]);
    }
  );
});

app.put("/meetings/:id", authenticateToken, (req, res) => {
  const appointmentId = req.params.id;
  const { title, start, end, location, guests, description } = req.body;
  const userId = req.user.id;

  const guestsArray = Array.isArray(guests) ? guests : JSON.parse(guests);

  pool.query(
    "UPDATE meetings SET title = ?, start = ?, end = ?, location = ?, guests = ?, description = ? WHERE id = ? AND user_id = ?",
    [
      title,
      start,
      end,
      location,
      JSON.stringify(guestsArray),
      description,
      appointmentId,
      userId,
    ],
    (error, result) => {
      if (error) return res.status(500).send("Server error");
      res.status(200).send("Appointment updated successfully");
    }
  );
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
