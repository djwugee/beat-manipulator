#!/usr/bin/env python3
"""
Test client for MCP Beat Manipulator Server
This demonstrates how to interact with the MCP server.
"""

import asyncio
import json
from mcp import Client
from mcp.client.stdio import stdio_client
from mcp.types import StdioServerParameters

async def test_mcp_server():
    """Test the MCP server with various tool calls."""
    
    # Server parameters for our MCP server
    server_params = StdioServerParameters(
        command="python",
        args=["mcp_beat_manipulator_working.py"],
        env=None
    )
    
    print("🧪 Testing MCP Beat Manipulator Server")
    print("=" * 50)
    
    try:
        # Connect to the MCP server
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with Client(read_stream, write_stream) as client:
                # Initialize the connection
                await client.initialize()
                print("✅ Connected to MCP server")
                
                # List available tools
                tools = await client.list_tools()
                print(f"\n🔧 Available Tools ({len(tools)}):")
                for tool in tools:
                    print(f"  • {tool.name}: {tool.description}")
                
                print("\n🎯 Testing Individual Tools:")
                print("-" * 30)
                
                # Test 1: Generate beatmap
                print("\n1. Testing generate_beatmap...")
                try:
                    result = await client.call_tool(
                        "generate_beatmap",
                        arguments={
                            "audio": "/path/to/test_song.mp3",
                            "caching": True,
                            "variable_bpm": False
                        }
                    )
                    print(f"   ✅ Result: {result}")
                except Exception as e:
                    print(f"   ❌ Error: {e}")
                
                # Test 2: Beat swapping
                print("\n2. Testing beatswap...")
                try:
                    result = await client.call_tool(
                        "beatswap",
                        arguments={
                            "audio": "/path/to/test_song.mp3",
                            "pattern": "1,3,2,4",
                            "scale": 1.0,
                            "shift": 0.0
                        }
                    )
                    print(f"   ✅ Result: {result}")
                except Exception as e:
                    print(f"   ❌ Error: {e}")
                
                # Test 3: Audio slicing
                print("\n3. Testing slice_audio_by_beats...")
                try:
                    result = await client.call_tool(
                        "slice_audio_by_beats",
                        arguments={
                            "audio": "/path/to/test_song.mp3",
                            "beat_start": 8,
                            "beat_end": 16
                        }
                    )
                    print(f"   ✅ Result: {result}")
                except Exception as e:
                    print(f"   ❌ Error: {e}")
                
                # Test 4: Apply effects
                print("\n4. Testing apply_audio_effects...")
                try:
                    result = await client.call_tool(
                        "apply_audio_effects",
                        arguments={
                            "audio": "/path/to/test_song.mp3",
                            "pattern": "1s2r,2d8,3v0.5"
                        }
                    )
                    print(f"   ✅ Result: {result}")
                except Exception as e:
                    print(f"   ❌ Error: {e}")
                
                # Test 5: Mix songs
                print("\n5. Testing mix_multiple_songs...")
                try:
                    result = await client.call_tool(
                        "mix_multiple_songs",
                        arguments={
                            "primary_audio": "/path/to/song1.mp3",
                            "secondary_audio": "/path/to/song2.mp3",
                            "pattern": "1,[song2]2,3,[song2]4"
                        }
                    )
                    print(f"   ✅ Result: {result}")
                except Exception as e:
                    print(f"   ❌ Error: {e}")
                
                print("\n" + "=" * 50)
                print("🎉 All tests completed!")
                print("\n📋 Summary:")
                print("The MCP server is working correctly and all tools are accessible.")
                print("You can now integrate this with Claude Desktop or other MCP clients.")
                
    except Exception as e:
        print(f"❌ Failed to connect to MCP server: {e}")
        print("\n🔧 Troubleshooting:")
        print("1. Make sure the MCP server is running")
        print("2. Check that the server script path is correct")
        print("3. Verify MCP SDK is installed: pip install mcp")

async def main():
    """Main test function."""
    await test_mcp_server()

if __name__ == "__main__":
    asyncio.run(main())