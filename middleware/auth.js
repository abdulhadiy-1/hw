const jwt = require("jsonwebtoken");

const Middleware = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token not found." });

  try {
    const decoded = jwt.verify(token, "soz");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token.", error });
  }
};

const RoleMiddleware = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Token is missing or invalid." });
  }

  if (!roles.includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "You do not have permission to perform this action." });
  }

  next();
};

module.exports = { Middleware, RoleMiddleware };
