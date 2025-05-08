import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this._initOnce(); // immediately trigger init logic
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
          page: z.number().optional()
        }),
        execute: async ({ invoiceId, page }) => {
          return { invoiceId, page };
        }
      }
    ];

    const registered = new Set<string>();

    for (const tool of allTools) {
      if (registered.has(tool.name)) {
        console.warn(`Tool "${tool.name}" is already registered, skipping.`);
        continue;
      }
      try {
        this.server.tool(tool.name, tool.parameters, tool.execute as any);
        registered.add(tool.name);
      } catch (err: any) {
        console.error(`Failed to register tool "${tool.name}": ${err.message}`);
      }
    }

    console.log(`Successfully added ${registered.size} tools to the MCP server.`);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sse") {
      return this.handleSSE();
    }

    if (url.pathname === "/") {
      return new Response("Welcome to the MCP server!", { status: 200 });
    }

    return new Response("Invalid endpoint", { status: 404 });
  }

  private handleSSE(): Response {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: Connected to SSE\n\n`));

        const interval = setInterval(() => {
          controller.enqueue(encoder.encode(`data: ${new Date().toISOString()}\n\n`));
        }, 5000);

        setTimeout(() => {
          clearInterval(interval);
          controller.close();
        }, 60000);
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
}
