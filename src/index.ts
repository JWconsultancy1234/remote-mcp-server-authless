import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { invoicesTools } from "./tools/invoices";
import { commissionsTools } from "./tools/commissions";
import { ordersTools } from "./tools/orders";

// Define Cloudflare Worker environment
declare const DurableObjectState: any;

export interface Env {
    BOL_CLIENT_ID: string;
    BOL_CLIENT_SECRET: string;
    MCP_OBJECT: DurableObjectNamespace;
}

// Define the main MCP class
export class MyMCP extends McpAgent {
    server = new McpServer({
        name: "Bol.com Retailer Tools",
        version: "1.0",
    });

    private initialized = false;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);

        // Defer init to avoid redundant re-runs
        this._initOnce();
    }

    // Run initialization logic only once
    private async _initOnce() {
        if (this.initialized) return;
        this.initialized = true;

        await this.init(); // Safe to run once
    }

    // Initialize all tools
    async init() {
        const allTools = [
            ...invoicesTools,
            ...commissionsTools,
            ...ordersTools,
            {
                name: "getInvoiceSpecification",
                parameters: z.object({ invoiceId: z.string(), page: z.number().optional() }),
                execute: async ({ invoiceId, page }) => {
                    // Your tool logic here
                },
            },
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

    // Serve the SSE endpoint

private async handleSSE(request: Request): Promise<Response> {
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(`data: Connected to SSE\n\n`));

            // Example: send ping every 5 seconds
            const interval = setInterval(() => {
                controller.enqueue(encoder.encode(`data: ${new Date().toISOString()}\n\n`));
            }, 5000);

            // Close connection after 1 minute (optional)
            setTimeout(() => {
                clearInterval(interval);
                controller.close();
            }, 60000);
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

	
	
    // Handle different routes within the `fetch` method
    async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
	
		if (url.pathname === '/sse') {
			return this.handleSSE(request);
		} else if (url.pathname === '/') {
			// Handle root path
			return new Response('Welcome to the MCP server!', { status: 200 });
		} else {
			// Handle invalid paths
			return new Response('Invalid endpoint', { status: 404 });
        }
    }
}

// Default export to handle requests
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const id = env.MCP_OBJECT.idFromName("mcp-server-instance");
        const stub = env.MCP_OBJECT.get(id);

        // Directly handle the request through the custom handler
        return stub.handleRequest(request);
    },
};
