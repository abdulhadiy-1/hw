const express = require("express");
const multer = require("multer");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const AuthRoute = require("./routes/auth");
const categoryhRoute = require("./routes/category");
const prdRoute = require("./routes/product");

const app = express();

// Middleware
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Папка для сохранения файлов
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Имя файла будет включать текущую метку времени
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Ограничение размера файла — 10MB
});

// Swagger настройки
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "API документация",
      version: "1.0.0",
      description: "Документация API для работы с ресурсами, пользователями и загрузкой файлов",
    },
    servers: [
      {
        url: "http://localhost:3000", // Или ваш серверный URL, если развернуто на продакшене
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ BearerAuth: [] }], // Обязательная аутентификация для всех маршрутов
  },
  apis: ["./index.js", "./routes/*.js"], // Путь к файлам с роутами
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Роуты для загрузки файлов
/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Загрузка файла
 *     description: Позволяет загружать файлы на сервер.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Файл успешно загружен
 *       400:
 *         description: Файл не загружен
 */
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Файл не загружен!" });
  }
  res.json({ message: "Файл успешно загружен!", file: req.file });
});

/**
 * @swagger
 * /get-url:
 *   post:
 *     summary: Получить URL загруженного файла
 *     description: Возвращает URL для загруженного файла.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 example: "example.jpg"
 *     responses:
 *       200:
 *         description: Возвращает URL файла
 *       400:
 *         description: Файл не указан
 */
app.post("/get-url", (req, res) => {
  const { file } = req.body;
  if (!file) {
    return res.status(400).json({ message: "Файл не указан!" });
  }
  res.json({ url: `http://localhost:3000/uploads/${file}` });
});

// Подключение роутов
app.use("/auth", AuthRoute);
app.use("/categories", categoryhRoute);
app.use("/resurses", prdRoute);

// Подключение Swagger UI для документации API
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.listen(3000, () => {
  console.log("Server is running on port 3000");
  console.log("API Documentation available at http://localhost:3000/api-docs");
});
