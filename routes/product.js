const { Router } = require("express");
const Joi = require("joi");
const { Middleware } = require("../middleware/auth");
const client = require("../prismaClient");
const route = Router();

/**
 * @swagger
 * /resurses:
 *   get:
 *     description: Get a list of resources with pagination and search
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of resources per page
 *         required: false
 *         type: integer
 *       - name: page
 *         in: query
 *         description: Page number to retrieve
 *         required: false
 *         type: integer
 *       - name: search
 *         in: query
 *         description: Search term to filter resources by name
 *         required: false
 *         type: string
 *       - name: sort
 *         in: query
 *         description: Sort order for resource names ("asc" or "desc")
 *         required: false
 *         type: string
 *     responses:
 *       200:
 *         description: List of resources
 *       500:
 *         description: Internal server error
 */
route.get("/", async (req, res) => {
  try {
    let limit = Number(req.query.limit) || 10;
    let page = Number(req.query.page) || 1;
    let offset = limit * (page - 1);
    let search = req.query.search || "";
    let sort = ["asc", "desc"].includes(req.query.sort?.toLowerCase())
      ? req.query.sort.toLowerCase()
      : "asc";

    const resurses = await client.product.findMany({
      where: {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      orderBy: {
        name: sort,
      },
      skip: offset,
      take: limit,
    });

    res.json({ resurses });
    logger.info("All resources retrieved");
  } catch (error) {
    res.status(500).json({ message: error.message });
    logger.error(error.message);
  }
});

/**
 * @swagger
 * /resurses/{id}:
 *   get:
 *     description: Get a specific resource by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Resource ID
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: The resource details
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
route.get("/:id", async (req, res) => {
  try {
    const resurs = await client.product.findUnique({
      where: { id: req.params.id },
    });
    if (!resurs) return res.status(404).json({ message: "Resource not found" });

    res.json(resurs);
    logger.info("Resource retrieved by ID");
  } catch (error) {
    res.status(500).json({ message: error.message });
    logger.error(error.message);
  }
});

const resursPostSchema = Joi.object({
  name: Joi.string().min(2).max(55).required(),
  price: Joi.number().required(),
  categoryId: Joi.number().required(),
});

/**
 * @swagger
 * /resurses:
 *   post:
 *     description: Create a new resource
 *     parameters:
 *       - name: name
 *         in: body
 *         description: Resource name
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: The name of the resource
 *               example: "Product A"
 *             price:
 *               type: number
 *               description: The price of the resource
 *               example: 100
 *             categoryId:
 *               type: number
 *               description: The ID of the category to which the resource belongs
 *               example: 1
 *     responses:
 *       201:
 *         description: Resource successfully created
 *       400:
 *         description: Validation error or category not found
 *       500:
 *         description: Internal server error
 */
route.post("/", Middleware, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { error } = resursPostSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const userId = req.user.id;
    const { categoryId, name, price } = req.body;

    const category = await client.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(400).json({ message: "Category not found" });
    }

    const newResurs = await client.product.create({ data: { name, price, categoryId, userId } });

    res.status(201).json(newResurs);
    logger.info("Resource created successfully");
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const resursPatchSchema = Joi.object({
  name: Joi.string().min(2).max(55).optional(),
  price: Joi.number().optional(),
});

/**
 * @swagger
 * /resurses/{id}:
 *   patch:
 *     description: Update a resource by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Resource ID
 *         required: true
 *         type: string
 *       - name: name
 *         in: body
 *         description: New name of the resource
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: The new name of the resource
 *       - name: price
 *         in: body
 *         description: New price of the resource
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             price:
 *               type: number
 *               description: The new price of the resource
 *     responses:
 *       200:
 *         description: Resource updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
route.patch("/:id", Middleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const resurs = await client.product.findUnique({ where: { id: req.params.id } });
    if (!resurs) return res.status(404).json({ message: "Resource not found" });

    if (!(req.user.role === "admin" || req.user.role === "super-admin" || req.user.id === resurs.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { error } = resursPatchSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const updatedResurs = await client.product.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updatedResurs);

    logger.info("Resource updated");
  } catch (error) {
    res.status(500).json({ message: error.message });
    logger.error(error.message);
  }
});

/**
 * @swagger
 * /resurses/{id}:
 *   delete:
 *     description: Delete a resource by ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: Resource ID
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Resource successfully deleted
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Internal server error
 */
route.delete("/:id", Middleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const resurs = await client.product.findUnique({ where: { id: req.params.id } });
    if (!resurs) return res.status(404).json({ message: "Resource not found" });

    if (!(req.user.role === "admin" || req.user.id === resurs.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await client.product.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Resource deleted" });
    logger.info("Resource deleted");
  } catch (error) {
    res.status(500).json({ message: error.message });
    logger.error(error.message);
  }
});

module.exports = route;
