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
                parameters: z.object({ invoiceId: z.string(), page: z.number().optional() }),
                execute: async ({ invoiceId, page }) => {
                    // Example logic
                    return { invoiceId, page };
                },
            },
        ];

        let newlyRegistered = 0;

        for (const tool of allTools) {
            if (this.registeredTools.has(tool.name)) {
                console.log(`Tool "${tool.name}" is already registered, skipping.`);
                continue;
            }

            try {
                this.server.tool(tool.name, tool.parameters, tool.execute as any);
                this.registeredTools.add(tool.name);
                newlyRegistered++;
                console.log(`Registered tool: ${tool.name}`);
            } catch (err: any) {
                console.error(`Failed to register tool "${tool.name}": ${err.message}`);
            }
        }

        console.log(`✅ Successfully registered ${newlyRegistered} new tool(s).`);
    }

    private async handleSSE(request: Request): Promise<Response> {
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
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/sse') {
            return this.handleSSE(request);
        }

        if (url.pathname === '/') {
            return new Response('Welcome to the MCP server!', { status: 200 });
        }

        return this.server.fetch(request); // Let MCPServer handle /mcp or tool-specific requests
    }
}

// Default Worker export for Cloudflare
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const id = env.MCP_OBJECT.idFromName("mcp-server-instance");
        const stub = env.MCP_OBJECT.get(id);
        return stub.fetch(request);
    },
};
