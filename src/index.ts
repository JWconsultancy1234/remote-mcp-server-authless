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
        this._initOnce();
    }

    private async _initOnce() {
        if (this.initialized) return;
        this.initialized = true;
        await this.init();
    }

    async init() {
        // Combine all tools into one array
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
            // Validate tool structure
            if (!tool.name || !tool.parameters || !tool.execute || typeof tool.execute !== 'function') {
                console.error(`Tool "${tool.name}" is missing required properties or execute is not a function. Skipping.`);
                continue;
            }

            if (registered.has(tool.name)) {
                console.warn(`Tool "${tool.name}" is already registered, skipping.`);
                continue;
            }

            try {
                console.log(`Registering tool: ${tool.name}`);
                // Register the tool
                this.server.tool(tool.name, tool.parameters, tool.execute as unknown as (params: any, env: Env) => Promise<any>);
                registered.add(tool.name);
            } catch (err: any) {
                console.error(`Failed to register tool "${tool.name}":`, err);
            }
        }

        console.log(`Successfully added ${registered.size} tools to the MCP server.`);
    }
}

// Default export for Cloudflare Worker
export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        if (url.pathname === "/sse" || url.pathname === "/sse/message") {
            return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
        }

        if (url.pathname === "/mcp") {
            return MyMCP.serve("/mcp").fetch(request, env, ctx);
        }

        return new Response("Not found", { status: 404 });
    },
};
