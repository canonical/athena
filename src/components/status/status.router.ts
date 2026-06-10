import { Router } from "express";

export const statusRouter = Router();

statusRouter.get(`/_status/check`, (_request, response) => {
  response.json({
    status: `ok`,
    whoami: `athena`,
  });
});

statusRouter.get(`/_status/ping`, (_request, response) => {
  response.json({
    status: `ok`,
    whoami: `athena`,
  });
});
