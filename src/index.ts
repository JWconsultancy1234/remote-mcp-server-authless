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
	
export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// @ts-ignore
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			// @ts-ignore
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
