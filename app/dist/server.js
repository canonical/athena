import { getEnvironmentSnapshot, getEnvironmentSnapshotPath } from "./components/environment/environment.service.js";
import express from "express";
const app = express();
const port = Number(process.env.ATHENA_PORT || 4141);
app.use(express.json());
app.get(`/health`, (_request, response) => {
    response.json({
        service: `athena`,
        status: `ok`,
        port,
        environmentSnapshotPath: getEnvironmentSnapshotPath(),
    });
});
app.get(`/environment`, async (request, response) => {
    const refresh = request.query.refresh === `1` || request.query.refresh === `true`;
    const snapshot = await getEnvironmentSnapshot({ refresh });
    response.json(snapshot);
});
app.post(`/route`, (request, response) => {
    response.json({
        decision: `noop`,
        escalate: false,
        received: request.body ?? null,
    });
});
const startServer = async () => {
    // await bootstrap();
    app.listen(port, `127.0.0.1`, () => {
        console.log(`Athena server listening on http://127.0.0.1:${port}`);
    });
};
void startServer();
//# sourceMappingURL=server.js.map