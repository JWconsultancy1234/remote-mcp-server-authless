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
    private registeredTools = new Set<string>();

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this._initOnce();
    }

    private async _initOnce() {
        if (this.initialized) return; // Prevent re-initialization
        this.initialized = true;
        await this.init(); // Call init() only once
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
                    console.log("Executing getInvoiceSpecification with invoiceId:", invoiceId, "and page:", page);
                    return { success: true }; // Example response
                },
            },
        ];

        const registered = new Set<string>();

        // Debug: Log tools array and check its structure
        console.log("All tools to be processed:", allTools);

        // Ensure tools are registered only once
        const toolsToRegister = allTools.filter((tool) => !this.registeredTools.has(tool.name));
        console.log(`Tools to register: ${toolsToRegister.length}`);

        for (const tool of toolsToRegister) {
            console.log('Tool being processed:', tool);

            // Log the tool structure
            if (!tool.name || !tool.parameters || !tool.execute || typeof tool.execute !== 'function') {
                console.error(`Tool "${tool.name}" is missing required properties or execute is not a function. Skipping.`);
                continue;
            }

            try {
                console.log(`Registering tool: ${tool.name}`);
                // Ensure tool is being passed correctly
                await this.server.tool(tool.name, tool.parameters, tool.execute as unknown as (params: any, env: Env) => Promise<any>);
                this.registeredTools.add(tool.name); // Mark this tool as registered
                registered.add(tool.name);
            } catch (err: any) {
                console.error(`Error registering tool "${tool.name}":`, err);
                console.error(`Tool details:`, tool);
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
