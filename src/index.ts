// src/index.ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env } from "./types";
import { invoicesTools } from "./tools/invoices";
import { commissionsTools } from "./tools/commissions";
import { ordersTools } from "./tools/orders";

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
        const allTools = [
            ...invoicesTools,
            ...commissionsTools,
            ...ordersTools,
        ];

        console.log("Raw invoicesTools:", JSON.stringify(invoicesTools, null, 2));
        console.log("Raw commissionsTools:", JSON.stringify(commissionsTools, null, 2));
        console.log("Raw ordersTools:", JSON.stringify(ordersTools, null, 2));

        console.log("invoicesTools length:", invoicesTools.length);
        console.log("invoicesTools[0]:", JSON.stringify({
            name: invoicesTools[0]?.name,
            parameters: invoicesTools[0]?.parameters?._def?.typeName,
            parametersShape: invoicesTools[0]?.parameters?._def?.typeName === "ZodObject" ? Object.keys(invoicesTools[0].parameters._def.shape()) : "unknown",
            hasExecute: !!invoicesTools[0]?.execute,
            isExecuteFunction: typeof invoicesTools[0]?.execute === "function",
        }, null, 2));
        console.log("invoicesTools[1]:", JSON.stringify({
            name: invoicesTools[1]?.name,
            parameters: invoicesTools[1]?.parameters?._def?.typeName,
            parametersShape: invoicesTools[1]?.parameters?._def?.typeName === "ZodObject" ? Object.keys(invoicesTools[1].parameters._def.shape()) : "unknown",
            hasExecute: !!invoicesTools[1]?.execute,
            isExecuteFunction: typeof invoicesTools[1]?.execute === "function",
        }, null, 2));

        console.log("commissionsTools length:", commissionsTools.length);
        console.log("commissionsTools[0]:", JSON.stringify({
            name: commissionsTools[0]?.name,
            parameters: commissionsTools[0]?.parameters?._def?.typeName,
            parametersShape: commissionsTools[0]?.parameters?._def?.typeName === "ZodObject" ? Object.keys(commissionsTools[0].parameters._def.shape()) : "unknown",
            hasExecute: !!commissionsTools[0]?.execute,
            isExecuteFunction: typeof commissionsTools[0]?.execute === "function",
        }, null, 2));
        console.log("commissionsTools[1]:", JSON.stringify({
            name: commissionsTools[1]?.name,
            parameters: commissionsTools[1]?.parameters?._def?.typeName,
            parametersShape: commissionsTools[1]?.parameters?._def?.typeName === "ZodObject" ? Object.keys(commissionsTools[1].parameters._def.shape()) : "unknown",
            hasExecute: !!commissionsTools[1]?.execute,
            isExecuteFunction: typeof commissionsTools[1]?.execute === "function",
        }, null, 2));

        console.log("ordersTools length:", ordersTools.length);
        console.log("ordersTools[0]:", JSON.stringify({
            name: ordersTools[0]?.name,
            parameters: ordersTools[0]?.parameters?._def?.typeName,
            parametersShape: ordersTools[0]?.parameters?._def?.typeName === "ZodObject" ? Object.keys(ordersTools[0].parameters._def.shape()) : "unknown",
            hasExecute: !!ordersTools[0]?.execute,
            isExecuteFunction: typeof ordersTools[0]?.execute === "function",
        }, null, 2));
        console.log("ordersTools[1]:", JSON.stringify({
            name: ordersTools[1]?.name,
            parameters: ordersTools[1]?.parameters?._def?.typeName,
            parametersShape: ordersTools[1]?.parameters?._def?.typeName === "ZodObject" ? Object.keys(ordersTools[1].parameters._def.shape()) : "unknown",
            hasExecute: !!ordersTools[1]?.execute,
            isExecuteFunction: typeof ordersTools[1]?.execute === "function",
        }, null, 2));

        console.log("All tools to be processed (count):", allTools.length);

        const registered = new Set<string>();
        const toolsToRegister = allTools.filter((tool) => !this.registeredTools.has(tool.name));
        console.log(`Tools to register: ${toolsToRegister.length}`);

        for (const tool of toolsToRegister) {
            const parametersShape = tool.parameters?._def?.typeName === "ZodObject" ? Object.keys(tool.parameters._def.shape()) : "unknown";
            console.log("Tool being processed:", {
                name: tool.name,
                parameters: tool.parameters?._def?.typeName || "undefined",
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

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/get-token') {
            const token = await this.state.storage.get('bolcom_token');
            if (!token) {
                return new Response('Token not found', { status: 404 });
            }
            return new Response(JSON.stringify(token), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (url.pathname === '/save-token' && request.method === 'POST') {
            const token = await request.json();
            await this.state.storage.put('bolcom_token', token);
            return new Response('Token saved', { status: 200 });
        }

        return super.fetch(request);
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
