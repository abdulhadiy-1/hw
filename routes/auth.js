const { Router } = require("express");
const bcrypt = require("bcrypt");
const joi = require("joi");
const nodemailer = require("nodemailer");
const { totp } = require("otplib");
const client = require("../prismaClient");
const jwt = require("jsonwebtoken");
const DeviceDetector = require("device-detector-js");
const { Middleware } = require("../middleware/auth");
const deviceDetector = new DeviceDetector();

const route = Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const generateAccessToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, "soz", {
    expiresIn: "15m",
  });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user.id }, "resoz", { expiresIn: "7d" });
};

async function SendMail(email, otp) {
  try {
    let mailOptions = {
      from: `"My App" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      text: `Your verification code is: ${otp}`,
    };
    let info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.log("Error while sending email:", error);
  }
}

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     description: Send OTP to user's email
 *     parameters:
 *       - name: email
 *         in: body
 *         required: true
 *         description: User's email address
 *         schema:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               description: User's email address
 *     responses:
 *       200:
 *         description: OTP successfully sent to email
 *       404:
 *         description: User with this email not found
 *       500:
 *         description: Internal server error
 */
route.post("/send-otp", async (req, res) => {
  try {
    let { email } = req.body;
    let user = await client.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User with this email not found" });
    }
    let otp = totp.generate(email + "soz");
    await SendMail(email, otp);
    res.json({ message: `OTP sent to ${email}!` });
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.log(error.message);
  }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     description: Register a new user
 *     parameters:
 *       - name: name
 *         in: body
 *         required: true
 *         description: User's name
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: User's full name
 *             email:
 *               type: string
 *               description: User's email address
 *             password:
 *               type: string
 *               description: User's password
 *             role:
 *               type: string
 *               description: User's role (optional)
 *     responses:
 *       201:
 *         description: User successfully created
 *       400:
 *         description: Invalid data or user already exists
 *       500:
 *         description: Internal server error
 */
route.post("/register", async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    let schema = joi.object({
      name: joi.string().min(3).max(50).trim().required(),
      email: joi.string().email().trim().required(),
      password: joi.string().min(6).trim().required(),
      role: joi.string().valid("user", "super_admin", "admin").optional(),
    });

    let { error } = schema.validate({ name, email, password, role });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    let user = await client.user.findUnique({ where: { email } });
    if (user) return res.status(400).json({ message: "User already exists" });
    let otp = totp.generate(email + "soz");
    await SendMail(email, otp);
    let hashedPassword = bcrypt.hashSync(password, 10);

    let newUser = await client.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "user",
        status: "pending",
      },
    });

    res.status(201).json({
      message: `User created successfully`,
      user: { name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @swagger
 * /auth/verify:
 *   post:
 *     description: Verify user's OTP code
 *     parameters:
 *       - name: email
 *         in: body
 *         required: true
 *         description: User's email address
 *         schema:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               description: User's email address
 *             otp:
 *               type: string
 *               description: OTP code sent to user's email
 *     responses:
 *       200:
 *         description: User successfully verified
 *       400:
 *         description: Invalid OTP or user not found
 *       500:
 *         description: Internal server error
 */
route.post("/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const isValid = totp.check(otp, email + "soz");
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await client.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User with this email not found" });
    }
    await client.user.update({
      where: { email },
      data: { status: "active" }
    });

    res.json({ message: "User verified!" });
    console.log("User verified!");
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.log("Verification error:", error.message);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     description: Get the logged-in user's details
 *     responses:
 *       200:
 *         description: The logged-in user's details
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       500:
 *         description: Internal server error
 */
route.get("/me", Middleware, async (req, res) => {
  try {
    let ip = req.ip;

    let session = await client.session.findFirst({
      where: {
        AND: [
          { ip: ip },
          { userId: req.user.id }
        ]
      }
    });

    if (!session) {
      return res
        .status(400)
        .json({ message: "No sessions found, please log in" });
    }

    const user = await client.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.log("Token error:", error.message);
    res.status(401).json({ message: "Problem with token", error: error.message });
  }
});

/**
 * @swagger
 * /auth/my-sessions:
 *   get:
 *     description: Get the list of the logged-in user's sessions
 *     responses:
 *       200:
 *         description: The list of user sessions
 *       500:
 *         description: Internal server error
 */
route.get("/my-sessions", Middleware, async (req, res) => {
  try {
    let sessions = await client.session.findMany({ where: { userId: req.user.id } });
    res.json(sessions);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "server error" });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     description: User login
 *     parameters:
 *       - name: email
 *         in: body
 *         required: true
 *         description: User's email address
 *         schema:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               description: User's email address
 *             password:
 *               type: string
 *               description: User's password
 *     responses:
 *       200:
 *         description: Successfully logged in with tokens
 *       400:
 *         description: Invalid email or password
 *       401:
 *         description: User is not verified
 *       500:
 *         description: Internal server error
 */
route.post("/login", async (req, res) => {
  try {
    const ip = req.ip;
    const { email, password } = req.body;

    const user = await client.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User with this email not found" });
    }

    if (user.status !== "active") {
      return res.status(400).json({ message: "User is not verified" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    let session = await client.session.findFirst({
      where: {
        ip,
        userId: user.id
      }
    });
    if (!session) {
      const userAgent = req.headers["user-agent"];
      const deviceData = deviceDetector.parse(userAgent);
      await client.session.create({
        data: {
          userId: user.id,
          ip,
          data: JSON.stringify(deviceData),
        },
      });
    }

    const AccessToken = generateAccessToken(user);
    const RefreshToken = generateRefreshToken(user);

    res.json({ message: "You are logged in", AccessToken, RefreshToken });
    console.log(`User ${user.id} logged in from IP: ${ip}`);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.log("Login error:", error.message);
  }
});

module.exports = route;
