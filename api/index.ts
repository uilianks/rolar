// Vercel Function: every /api/* request is rewritten here (vercel.json) and handled by the Hono app.
import { buildApp } from "../server/main";

const ready = buildApp();
const handler = async (request: Request) => (await ready).app.fetch(request);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
