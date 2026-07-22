import { Router } from "express";
import { classifyProductIntake } from "../lib/productIntake.js";
import { productIntakeSchema, validateBody } from "../lib/validation.js";

const router = Router();

router.post("/products/intake", validateBody(productIntakeSchema), (req, res) => {
  const result = classifyProductIntake(req.body.query, req.body.source);
  res.status(result.valid ? 200 : 422).json(result);
});

export default router;
