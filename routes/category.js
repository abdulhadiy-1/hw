const { Router } = require("express");
const Joi = require("joi");
const { Middleware, RoleMiddleware } = require("../middleware/auth");
const client = require("../prismaClient");

const route = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Получить список категорий с пагинацией и поиском
 *     description: Возвращает список категорий с возможностью пагинации, сортировки и поиска.
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Количество категорий на странице
 *         required: false
 *         schema:
 *           type: integer
 *       - name: page
 *         in: query
 *         description: Номер страницы
 *         required: false
 *         schema:
 *           type: integer
 *       - name: search
 *         in: query
 *         description: Поисковый запрос для фильтрации по названию
 *         required: false
 *         schema:
 *           type: string
 *       - name: sort
 *         in: query
 *         description: Порядок сортировки названий категорий ("asc" или "desc")
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Список категорий
 *       500:
 *         description: Внутренняя ошибка сервера
 */

route.get("/", async (req, res) => {
  try {
    let limit = Number(req.query.limit) || 10;
    let page = Number(req.query.page) || 1;
    let skip = limit * (page - 1);
    let search = req.query.search || "";
    let sort = ["asc", "desc"].includes(req.query.sort?.toLowerCase())
      ? req.query.sort.toLowerCase()
      : "asc";

    const categories = await client.category.findMany({
      where: {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      orderBy: {
        name: sort,
      },
      skip,
      take: limit,
    });

    res.json({ categories });
    console.log("All categories retrieved");
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error(error.message);
  }
});

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Получить категорию по ID
 *     description: Возвращает данные конкретной категории по её ID.
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID категории
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Детали категории
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Внутренняя ошибка сервера
 */

route.get("/:id", async (req, res) => {
  try {
    const category = await client.category.findUnique({
      where: { id: req.params.id },
    });
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    res.json(category);
    console.log("Category retrieved by ID");
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error(error.message);
  }
});

const categoryPostSchema = Joi.object({
  name: Joi.string().min(2).max(55).required(),
});

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Создать новую категорию
 *     description: Создаёт новую категорию с указанным именем.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Название категории
 *                 example: "Электроника"
 *     responses:
 *       200:
 *         description: Категория успешно создана
 *       400:
 *         description: Категория уже существует или ошибка валидации
 *       500:
 *         description: Внутренняя ошибка сервера
 */

route.post("/", Middleware, RoleMiddleware(["admin"]), async (req, res) => {
  try {
    const { name } = req.body;

    if (await client.category.findFirst({ where: { name } })) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const { error } = categoryPostSchema.validate({ name });
    if (error)
      return res.status(400).json({ message: error.details[0].message });

    const newCategory = await client.category.create({ data: { name } });
    res.json(newCategory);
    console.log("Category created");
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error(error.message);
  }
});

const categoryPatchSchema = Joi.object({
  name: Joi.string().min(2).max(55).optional(),
});
/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Обновить категорию по ID
 *     description: Обновляет категорию по ID с новым именем.
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID категории
 *         required: true
 *         type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Новое имя категории
 *                 example: "Техника"
 *     responses:
 *       200:
 *         description: Категория успешно обновлена
 *       400:
 *         description: Ошибка валидации
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Внутренняя ошибка сервера
 */

route.patch(
  "/:id",
  Middleware,
  RoleMiddleware(["admin", "super-admin"]),
  async (req, res) => {
    try {
      const category = await client.category.findUnique({
        where: { id: req.params.id },
      });
      if (!category)
        return res.status(404).json({ message: "Category not found" });

      const { error } = categoryPatchSchema.validate(req.body);
      if (error)
        return res.status(400).json({ message: error.details[0].message });

      await client.category.update({
        where: { id: req.params.id },
        data: req.body,
      });

      res.json(category);
      console.log("Category updated");
    } catch (error) {
      res.status(500).json({ message: error.message });
      console.error(error.message);
    }
  }
);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Удалить категорию по ID
 *     description: Удаляет категорию по указанному ID.
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID категории
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Категория успешно удалена
 *       404:
 *         description: Категория не найдена
 *       500:
 *         description: Внутренняя ошибка сервера
 */

route.delete(
  "/:id",
  Middleware,
  RoleMiddleware(["admin"]),
  async (req, res) => {
    try {
      const category = await client.category.findUnique({
        where: { id: req.params.id },
      });
      if (!category)
        return res.status(404).json({ message: "Category not found" });

      await client.category.delete({
        where: { id: req.params.id },
      });

      res.json({ message: "Category deleted" });
      console.log("Category deleted");
    } catch (error) {
      res.status(500).json({ message: error.message });
      console.error(error.message);
    }
  }
);

module.exports = route;
