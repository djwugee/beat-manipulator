# How to run the Beat Manipulator MCP Server

This document provides instructions on how to run the Beat Manipulator MCP server and connect it to an MCP client.

## Running the server directly

To run the server directly from your terminal, navigate to the project's root directory and run the following command:

```bash
python mcp_server.py
```

The server will start and listen for requests on standard input/output (stdio).

## Connecting to an MCP Client

To connect the server to an MCP client (like Claude for Desktop), you need to configure the client to launch the server. The exact steps may vary depending on the client, but here is an example configuration for Claude for Desktop.

1.  Open your MCP client's configuration file. For Claude for Desktop, this is typically located at `~/Library/Application Support/Claude/claude_desktop_config.json`.

2.  Add the following configuration to the `mcpServers` section. If the `mcpServers` key does not exist, you will need to add it.

    ```json
    {
      "mcpServers": {
        "beat_manipulator": {
          "command": "python",
          "args": [
            "/ABSOLUTE/PATH/TO/PROJECT/mcp_server.py"
          ]
        }
      }
    }
    ```

3.  **Important:** Replace `/ABSOLUTE/PATH/TO/PROJECT/` with the absolute path to the directory where you have cloned this repository.

4.  Save the configuration file and restart your MCP client.

The client should now be able to see and use the tools provided by the Beat Manipulator MCP server.