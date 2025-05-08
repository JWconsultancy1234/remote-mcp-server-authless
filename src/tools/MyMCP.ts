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

type ToolExecute = (params: any, env: Env) => Promise<any>;

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
        if (this.initialized) {
            console.log("Already initialized, skipping.");
            return;
        }
        this.initialized = true;
        console.log("Initializing MCP...");
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
                execute: async ({ invoiceId, page }, env: Env) => {
                    console.log("Executing getInvoiceSpecification with invoiceId:", invoiceId, "and page:", page);
                    return { success: true };
                },
            },
        ];

        const registered = new Set<string>();
        console.log("All tools to be processed (count):", allTools.length);

        const toolsToRegister = allTools.filter((tool) => !this.registeredTools.has(tool.name));
        console.log(`Tools to register: ${toolsToRegister.length}`);

        for (const tool of toolsToRegister) {
            // Log tool without execute to avoid serialization issues
            console.log("Tool being processed:", {
                name: tool.name,
                parameters: tool.parameters,
                hasExecute: !!tool.execute,
                isExecuteFunction: typeof tool.execute === "function",
            });

            // Validate tool structure
            if (!tool.name || !tool.parameters || !tool.execute || typeof tool.execute !== "function") {
                console.error(`Tool "${tool.name}" is missing required properties or execute is not a function. Skipping.`, {
                    name: tool.name,
                    hasParameters: !!tool.parameters,
                    hasExecute: !!tool.execute,
                    isExecuteFunction: typeof tool.execute === "function",
                });
                continue;
            }

            // Validate zod schema
            if (!(tool.parameters instanceof z.ZodType)) {
                console.error(`Tool "${tool.name}" has invalid parameters. Expected a zod schema, got:`, tool.parameters);
                continue;
            }

            // Check if schema is empty
            const schemaDef = tool.parameters._def;
            if (schemaDef.typeName === "ZodObject" && Object.keys(schemaDef.shape()).length === 0) {
                console.warn(`Tool "${tool.name}" has an empty schema (z.object({})). This may cause issues.`);
            }

            try {
                console.log(`Registering tool: ${tool.name}`);
                await this.server.tool(tool.name, tool.parameters, tool.execute as ToolExecute);
                this.registeredTools.add(tool.name);
                registered.add(tool.name);
            } catch (err) {
                console.error(`Error registering tool "${tool.name}":`, err);
                console.error(`Tool details:`, {
                    name: tool.name,
                    parameters: tool.parameters,
                    hasExecute: !!tool.execute,
                });
            }
        }

        console.log(`Successfully added ${registered.size} tools to the MCP server.`);
    }
}

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
