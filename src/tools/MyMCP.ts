import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodTypeAny } from "zod";

import { invoicesTools } from "./tools/invoices";
import { commissionsTools } from "./tools/commissions";
import { ordersTools } from "./tools/orders";

export interface Env {
  BOL_CLIENT_ID: string;
  BOL_CLIENT_SECRET: string;
  MCP_OBJECT: DurableObjectNamespace;
}

export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Bol.com Retailer Tools",
    version: "1.0",
  });

  private initialized = false;
  private registeredTools = new Set<string>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this._initOnce();
  }

  private async _initOnce() {
    if (this.initialized) return;
    this.initialized = true;
    await this.init();
  }

  async init() {
    const allTools = [
      ...invoicesTools,
      ...commissionsTools,
      ...ordersTools,
      {
        name: "getInvoiceSpecification",
        parameters: z.object({
          invoiceId: z.string(),
          page: z.number().optional(),
        }),
        execute: async ({ invoiceId, page }) => {
          console.log("Executing getInvoiceSpecification:", { invoiceId, page });
          return { success: true, invoiceId, page };
        },
      },
    ];

    const registered = new Set<string>();

    for (const tool of allTools) {
      const { name, parameters, execute } = tool;

      if (!name || typeof name !== "string") {
        console.warn("Skipping tool with invalid name:", name);
        continue;
      }

      if (this.registeredTools.has(name)) {
        console.log(`Tool "${name}" already registered. Skipping.`);
        continue;
      }

      // Extra validation for tool schema
      const isValidSchema =
        parameters && typeof parameters === "object" && "_def" in parameters;

      if (!isValidSchema || typeof execute !== "function") {
        console.error(`Tool "${name}" has invalid parameters or execute.`);
        continue;
      }

      try {
        this.server.tool(name, parameters as ZodTypeAny, execute as any);
        this.registeredTools.add(name);
        registered.add(name);
        console.log(`✅ Registered tool: ${name}`);
      } catch (err: any) {
        console.error(`❌ Failed to register tool "${name}":`, err.message);
      }
    }

    console.log(`🔧 Total tools registered: ${registered.size}`);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse").fetch(request, this.env, this.ctx);
    }

    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, this.env, this.ctx);
    }

    return new Response("Not found", { status: 404 });
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const id = env.MCP_OBJECT.idFromName("mcp-server-instance");
    const stub = env.MCP_OBJECT.get(id);
    return stub.fetch(request);
  },
};
