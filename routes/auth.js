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
totp.options = {
  step: 300
}
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
 *     summary: Отправить OTP на email пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Электронная почта пользователя
 *     responses:
 *       200:
 *         description: OTP успешно отправлен на email
 *       404:
 *         description: Пользователь с таким email не найден
 *       500:
 *         description: Внутренняя ошибка сервера
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
    res.json({ message: `OTP sent to ${email}! ${otp}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.log(error.message);
  }
});
/**
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Имя пользователя
 *               email:
 *                 type: string
 *                 description: Электронная почта
 *               password:
 *                 type: string
 *                 description: Пароль
 *               role:
 *                 type: string
 *                 description: Роль (необязательно)
 *     responses:
 *       201:
 *         description: Пользователь успешно создан
 *       400:
 *         description: Неверные данные или пользователь уже существует
 *       500:
 *         description: Внутренняя ошибка сервера
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
      message: `User created successfully ${otp}`,
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
 *     summary: Подтверждение кода OTP
 *     description: Проверка OTP-кода, отправленного на почту пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Электронная почта пользователя
 *               otp:
 *                 type: string
 *                 description: OTP-код, отправленный на почту
 *     responses:
 *       200:
 *         description: Пользователь успешно подтверждён
 *       400:
 *         description: Неверный OTP или пользователь не найден
 *       500:
 *         description: Внутренняя ошибка сервера
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
 *     summary: Авторизация пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Успешная авторизация
 *       400:
 *         description: Ошибка валидации
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
