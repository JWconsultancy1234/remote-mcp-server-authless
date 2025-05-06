import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Authless Calculator",
    version: "1.0.0",
  });
  // Haal je secrets op (zorg ervoor dat de secrets zijn ingesteld via wrangler)
  const clientId = await this.secret("BOL_CLIENT_ID");
  const clientSecret = await this.secret("BOL_CLIENT_SECRET");

  async init() {

    let url = 'https://login.bol.com/token?grant_type=client_credentials';

    let options = {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${base64Credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    let url = 'https://api.bol.com/retailer/orders?fulfilment-method=ALL&status=ALL&latest-change-date='+new Date().toISOString().split('T')[0];
    //    let url = 'https://api.bol.com/retailer/orders?fulfilment-method=ALL&status=ALL&latest-change-date=2024-10-01'
        console.log(url)
        let options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`,
               // 'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/vnd.retailer.v10+json'
            }
        };

    

    // Simple addition tool
    this.server.tool(
      "add",
      { a: z.number(), b: z.number() },
      async ({ a, b }) => ({
        content: [{ type: "text", text: String(a + b) }],
      })
    );

    // Calculator tool with multiple operations
    this.server.tool(
      "calculate",
      {
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number(),
        b: z.number(),
      },
      async ({ operation, a, b }) => {
        let result: number;
        switch (operation) {
          case "add":
            result = a + b;
            break;
          case "subtract":
            result = a - b;
            break;
          case "multiply":
            result = a * b;
            break;
          case "divide":
            if (b === 0)
              return {
                content: [
                  {
                    type: "text",
                    text: "Error: Cannot divide by zero",
                  },
                ],
              };
            result = a / b;
            break;
        }
        return { content: [{ type: "text", text: String(result) }] };
      }
    );

    // New tool to fetch product info from bol.com API
    this.server.tool(
      "getBolProduct",
      { productId: z.string() },
      async ({ productId }) => {
        // Make the API call to bol.com
        const response = await fetch(`https://api.bol.com/retailer/products/${productId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${clientId}:${clientSecret}`,
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching data for product ID ${productId}: ${response.statusText}`,
              },
            ],
          };
        }

        const data = await response.json();
        return {
          content: [
            {
              type: "text",
              text: `Product details: ${JSON.stringify(data)}`,
            },
          ],
        };
      }
    );
  }
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
