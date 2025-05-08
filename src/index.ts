// src/index.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { invoicesTools } from "./tools/invoices";
import { commissionsTools } from "./tools/commissions";
import { ordersTools } from "./tools/orders";
import { Env } from "./types";

declare const DurableObjectState: any;

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
        console.log("Raw invoicesTools:", invoicesTools);
        console.log("Raw commissionsTools:", commissionsTools);
        console.log("Raw ordersTools:", ordersTools);

        if (!invoicesTools || !Array.isArray(invoicesTools)) {
            console.error("invoicesTools is invalid or not an array:", invoicesTools);
        } else {
            console.log("invoicesTools length:", invoicesTools.length);
            invoicesTools.forEach((tool, index) => {
                console.log(`invoicesTools[${index}]:`, {
                    name: tool.name,
                    hasParameters: !!tool.parameters,
                    hasExecute: !!tool.execute,
                });
            });
        }
        if (!commissionsTools || !Array.isArray(commissionsTools)) {
            console.error("commissionsTools is invalid or not an array:", commissionsTools);
        } else {
            console.log("commissionsTools length:", commissionsTools.length);
        }
        if (!ordersTools || !Array.isArray(ordersTools)) {
            console.error("ordersTools is invalid or not an array:", ordersTools);
        } else {
            console.log("ordersTools length:", ordersTools.length);
        }

        const allTools = [
            ...(Array.isArray(invoicesTools) ? invoicesTools : []),
            ...(Array.isArray(commissionsTools) ? commissionsTools : []),
            ...(Array.isArray(ordersTools) ? ordersTools : []),
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
            const parametersShape = tool.parameters?._def?.typeName === "ZodObject" ? Object.keys(tool.parameters._def.shape()) : "unknown";
            console.log("Tool being processed:", {
                name: tool.name,
                parametersShape,
                hasExecute: !!tool.execute,
                isExecuteFunction: typeof tool.execute === "function",
            });

            if (!tool.name || !tool.parameters || !tool.execute || typeof tool.execute !== "function") {
                console.error(`Tool "${tool.name}" is missing required properties or execute is not a function. Skipping.`, {
                    name: tool.name,
                    hasParameters: !!tool.parameters,
                    hasExecute: !!tool.execute,
                    isExecuteFunction: typeof tool.execute === "function",
                });
                continue;
            }

            if (!(tool.parameters instanceof z.ZodType)) {
                console.error(`Tool "${tool.name}" has invalid parameters. Expected a zod schema, got:`, tool.parameters);
                continue;
            }

            if (tool.parameters._def.typeName === "ZodObject" && Object.keys(tool.parameters._def.shape()).length === 0) {
                console.error(`Tool "${tool.name}" has an empty schema (z.object({})). This is likely incorrect.`);
                continue;
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
                    parametersShape,
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
