const { Router } = require("express");
const Joi = require("joi");
const { Middleware, RoleMiddleware } = require("../middleware/auth");
const client = require("../prismaClient");

const route = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     description: Get a list of categories with pagination and search
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of categories per page
 *         required: false
 *         type: integer
 *       - name: page
 *         in: query
 *         description: Page number to retrieve
 *         required: false
 *         type: integer
 *       - name: search
 *         in: query
 *         description: Search term to filter categories by name
 *         required: false
 *         type: string
 *       - name: sort
 *         in: query
 *         description: Sort order for category names ("asc" or "desc")
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: List of categories
 *       500:
 *         description: Internal server error
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
 *     description: Get a specific category by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Category ID
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: The category details
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
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
 *     description: Create a new category
 *     parameters:
 *       - name: name
 *         in: body
 *         description: Category name
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: The name of the category
 *               example: "Electronics"
 *     responses:
 *       200:
 *         description: Category successfully created
 *       400:
 *         description: Category already exists or validation error
 *       500:
 *         description: Internal server error
 */
route.post("/", Middleware, RoleMiddleware(["admin"]), async (req, res) => {
  try {
    const { name } = req.body;

    if (await client.category.findUnique({ where: { name } })) {
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
 *     description: Update a category by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Category ID
 *         required: true
 *         type: string
 *       - name: name
 *         in: body
 *         description: New name of the category
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: The new name of the category
 *     responses:
 *       200:
 *         description: Category updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
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
 *     description: Delete a category by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Category ID
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Category successfully deleted
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
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
