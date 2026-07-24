import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { CreateMatchRequestUseCase } from "../../../../application/usecases/match/create-match-request.usecase.js";
import type { GetMatchTicketUseCase } from "../../../../application/usecases/match/get-match-ticket.usecase.js";
import {
  CV_MAX_FILE_SIZE_BYTES,
  isCvMimeType,
} from "../../../../domain/cv/cv-upload.entity.js";
import { UnsupportedCvFileTypeError } from "../../../../domain/cv/errors/unsupported-cv-file-type.error.js";
import { CvFileTooLargeError } from "../../../../domain/cv/errors/cv-file-too-large.error.js";
import { MatchRateLimitExceededError } from "../../../../domain/rate-limiting/errors/match-rate-limit-exceeded.error.js";

export interface MatchControllerDependencies {
  readonly createMatchRequestUseCase: CreateMatchRequestUseCase;
  readonly getMatchTicketUseCase: GetMatchTicketUseCase;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CV_MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!isCvMimeType(file.mimetype)) {
      callback(new UnsupportedCvFileTypeError(file.mimetype));
      return;
    }
    callback(null, true);
  },
});

export function createMatchRouter(deps: MatchControllerDependencies): Router {
  const router = Router();

  router.post(
    "/",
    upload.single("cv"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: "A CV file is required." });
          return;
        }

        const { ticketId, remaining } = await deps.createMatchRequestUseCase.execute({
          cvFile: { buffer: req.file.buffer, mimeType: req.file.mimetype },
          ip: req.ip ?? "unknown",
          now: new Date(),
        });

        res.status(202).json({ ticketId, remaining });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ticketId = req.params.id;
        if (!ticketId) {
          res.status(404).json({ error: "Match ticket not found." });
          return;
        }

        const ticket = await deps.getMatchTicketUseCase.execute(ticketId);
        if (!ticket) {
          res.status(404).json({ error: "Match ticket not found." });
          return;
        }
        res.status(200).json(ticket);
      } catch (error) {
        next(error);
      }
    },
  );

  router.use(matchErrorHandler);

  return router;
}

function matchErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    error instanceof UnsupportedCvFileTypeError ||
    error instanceof CvFileTooLargeError
  ) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof MatchRateLimitExceededError) {
    res.status(429).json({
      error: error.message,
      resetAt: error.resetAt.toISOString(),
    });
    return;
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({
      error: `CV file exceeds the ${CV_MAX_FILE_SIZE_BYTES} byte limit.`,
    });
    return;
  }

  next(error);
}
