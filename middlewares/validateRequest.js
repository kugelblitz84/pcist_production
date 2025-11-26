import { ZodError } from "zod";

const formatIssues = (issues) =>
  issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

const parseSegment = (schema, payload) => {
  if (!schema) {
    return { success: true, data: payload };
  }

  const result = schema.safeParse(payload ?? {});
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: result.data };
};

const validateRequest = ({ body, params, query } = {}) => {
  return (req, res, next) => {
    try {
      const bodyResult = parseSegment(body, req.body);
      if (!bodyResult.success) {
        throw bodyResult.error;
      }
      if (body) {
        req.body = bodyResult.data;
      }

      const paramsResult = parseSegment(params, req.params);
      if (!paramsResult.success) {
        throw paramsResult.error;
      }
      if (params) {
        req.params = paramsResult.data;
      }

      const queryResult = parseSegment(query, req.query);
      if (!queryResult.success) {
        throw queryResult.error;
      }
      if (query) {
        req.query = queryResult.data;
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: formatIssues(error.issues),
        });
      }

      return next(error);
    }
  };
};

export default validateRequest;
