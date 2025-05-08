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
    private registeredTools = new Set<string>(); // Track registered tools

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
        // Collect all tools in a single array
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

        // Register each tool only if it is not already registered
        for (const tool of allTools) {
            if (this.registeredTools.has(tool.name)) {
                console.warn(`Tool "${tool.name}" is already registered, skipping.`);
                continue;
            }

            try {
                // Register the tool with the MCP server
                this.server.tool(tool.name, tool.parameters, tool.execute as any);
                this.registeredTools.add(tool.name); // Mark the tool as registered
                console.log(`Successfully registered tool: ${tool.name}`);
            } catch (err: any) {
                console.error(`Failed to register tool "${tool.name}": ${err.message}`);
            }
        }

        console.log(`Successfully added ${this.registeredTools.size} tools to the MCP server.`);
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
