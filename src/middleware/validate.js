/**
 * Zod validation middleware factory.
 * Validates req.body against the provided Zod schema.
 * Returns VALIDATION_ERROR with details array on failure.
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details,
        },
      });
    }

    req.body = result.data;
    next();
  };
}

export default validate;
