import serverless from "serverless-http";
import { createServer } from "../server";

const handler = serverless(createServer());

export default handler;


