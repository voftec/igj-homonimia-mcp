#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testIGJHomonimiaMCP() {
  console.log("Testing IGJ Homonimia MCP Server...\n");

  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/index.ts"]
  });

  try {
    await client.connect(transport);
    console.log("✓ Connected to MCP server\n");

    // List available tools
    const tools = await client.listTools();
    console.log(`Available tools (${tools.tools.length}):`);
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log("");

    // List available prompts
    const prompts = await client.listPrompts();
    console.log(`Available prompts (${prompts.prompts.length}):`);
    prompts.prompts.forEach(prompt => {
      console.log(`  - ${prompt.name}: ${prompt.description}`);
    });
    console.log("");

    // Test prompt generation
    if (prompts.prompts.length > 0) {
      console.log(`Testing consultar_homonimia_sa prompt...`);
      try {
        const promptResult = await client.getPrompt({
          name: "consultar_homonimia_sa",
          arguments: { denominacion: "TEST SA" }
        });
        console.log("✓ Prompt generation successful");
        console.log("Prompt:", promptResult.messages[0].content.text);
      } catch (error) {
        console.log("✗ Prompt generation failed:", error.message);
      }
    } else {
      console.log("No prompts available to test");
    }
    console.log("");

    // Test a tool call (generic consultar_homonimia with required params)
    console.log("Testing consultar_homonimia tool...");
    try {
      const result = await client.callTool({
        name: "consultar_homonimia",
        arguments: {
          denominacion: "TEST SA",
          categoria: "050"
        }
      });
      console.log("✓ Tool call successful");
      console.log("Response:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.log("✗ Tool call failed (expected - requires CAPTCHA):", error.message);
    }
    console.log("");

    console.log("All tests completed!");

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

testIGJHomonimiaMCP();
