#!/usr/bin/env python3
"""
Working MCP (Model Context Protocol) Server for Beat Manipulator
This version uses the correct MCP SDK API.
"""

import asyncio
import json
import logging
import sys
from typing import Any, Dict, List, Optional
from pathlib import Path

# Configure logging to stderr for MCP compliance
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger(__name__)

# Mock beat_manipulator for demo purposes
class MockBeatManipulator:
    """Mock implementation for demo purposes."""
    
    @staticmethod
    def song(audio):
        logger.info(f"Mock: Loading song from {audio}")
        return MockSong(audio)

class MockSong:
    """Mock song object for demo purposes."""
    
    def __init__(self, audio_path):
        self.audio_path = audio_path
        self.sr = 44100
        self.beatmap = [i * 44100 for i in range(1, 101)]  # Mock 100 beats
        
    def beatmap_generate(self, lib=None, caching=True):
        logger.info(f"Mock: Generating beatmap using {lib or 'default'}, caching={caching}")
        
    def beatmap_shift(self, shift):
        logger.info(f"Mock: Shifting beatmap by {shift} beats")
        
    def beatmap_scale(self, scale):
        logger.info(f"Mock: Scaling beatmap by factor of {scale}")
        
    def beatswap(self, pattern, scale=1, shift=0, effects=None, samples=None):
        logger.info(f"Mock: Beatswapping with pattern '{pattern}', scale={scale}, shift={shift}")
        return f"Beatswapped audio with pattern '{pattern}'"
        
    def write(self, output):
        logger.info(f"Mock: Writing output to {output}")
        
    def __getitem__(self, key):
        logger.info(f"Mock: Slicing audio with key {key}")
        return f"Sliced audio segment for key {key}"

# Use mock instead of real beat_manipulator
bm = MockBeatManipulator()

from mcp.server.models import InitializationOptions
from mcp.server.lowlevel import Server, NotificationOptions
from mcp.server import stdio
from mcp.types import (
    Tool,
    TextContent,
)

class BeatManipulatorMCPServer:
    def __init__(self):
        self.server = Server("beat-manipulator-mcp")
        self.setup_tools()
        
    def setup_tools(self):
        """Setup MCP tools for beat manipulation functionality."""
        
        @self.server.list_tools()
        async def handle_list_tools() -> List[Tool]:
            """List available beat manipulation tools."""
            return [
                Tool(
                    name="beatswap",
                    description="Swap beats in an audio file using a pattern",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "audio": {
                                "type": "string",
                                "description": "Path to audio file or numpy array"
                            },
                            "pattern": {
                                "type": "string", 
                                "description": "Beat swapping pattern (e.g., '1,3,2,4' to swap 2nd and 3rd beats)"
                            },
                            "scale": {
                                "type": "number",
                                "description": "Scale factor for beatmap (0.5 = half tempo, 2 = double tempo)",
                                "default": 1.0
                            },
                            "shift": {
                                "type": "number",
                                "description": "Shift beatmap in beats (positive = forward, negative = backward)",
                                "default": 0.0
                            },
                            "output": {
                                "type": "string",
                                "description": "Output file path (optional, auto-generated if not specified)",
                                "default": ""
                            }
                        },
                        "required": ["audio", "pattern"]
                    }
                ),
                Tool(
                    name="generate_beatmap",
                    description="Generate beatmap for an audio file using madmom library",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "audio": {
                                "type": "string",
                                "description": "Path to audio file"
                            },
                            "caching": {
                                "type": "boolean",
                                "description": "Enable caching of beatmaps for faster subsequent processing",
                                "default": True
                            },
                            "variable_bpm": {
                                "type": "boolean", 
                                "description": "Use variable BPM detection instead of fixed tempo",
                                "default": False
                            }
                        },
                        "required": ["audio"]
                    }
                ),
                Tool(
                    name="slice_audio_by_beats",
                    description="Slice audio into individual beats",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "audio": {
                                "type": "string",
                                "description": "Path to audio file"
                            },
                            "beat_start": {
                                "type": "number",
                                "description": "Starting beat number (1-indexed)"
                            },
                            "beat_end": {
                                "type": "number",
                                "description": "Ending beat number (can be fractional, e.g., 4.5 for halfway through 4th beat)"
                            }
                        },
                        "required": ["audio", "beat_start"],
                        "optional": ["beat_end"]
                    }
                ),
                Tool(
                    name="apply_audio_effects",
                    description="Apply audio effects to beats using pattern syntax",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "audio": {
                                "type": "string",
                                "description": "Path to audio file"
                            },
                            "pattern": {
                                "type": "string",
                                "description": "Pattern with effects (e.g., '1s2r' for 1st beat at 2x speed and reversed)"
                            },
                            "effects": {
                                "type": "object",
                                "description": "Custom effects dictionary (optional)"
                            }
                        },
                        "required": ["audio", "pattern"]
                    }
                ),
                Tool(
                    name="mix_multiple_songs",
                    description="Mix multiple songs using beat manipulation patterns",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "primary_audio": {
                                "type": "string",
                                "description": "Path to primary audio file"
                            },
                            "secondary_audio": {
                                "type": "string",
                                "description": "Path to secondary audio file to mix"
                            },
                            "pattern": {
                                "type": "string",
                                "description": "Pattern for mixing (use [song_name] syntax, e.g., '1,[song2]2,3,[song2]4')"
                            },
                            "output": {
                                "type": "string",
                                "description": "Output file path",
                                "default": ""
                            }
                        },
                        "required": ["primary_audio", "secondary_audio", "pattern"]
                    }
                )
            ]
        
        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: dict | None) -> List[TextContent]:
            """Handle tool execution."""
            try:
                if name == "beatswap":
                    return await self.handle_beatswap(arguments)
                elif name == "generate_beatmap":
                    return await self.handle_generate_beatmap(arguments)
                elif name == "slice_audio_by_beats":
                    return await self.handle_slice_audio_by_beats(arguments)
                elif name == "apply_audio_effects":
                    return await self.handle_apply_audio_effects(arguments)
                elif name == "mix_multiple_songs":
                    return await self.handle_mix_multiple_songs(arguments)
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
            except Exception as e:
                logger.error(f"Error executing tool {name}: {e}")
                return [TextContent(type="text", text=f"Error: {str(e)}")]
    
    async def handle_beatswap(self, arguments: dict) -> List[TextContent]:
        """Handle beat swapping functionality."""
        audio = arguments.get("audio")
        pattern = arguments.get("pattern")
        scale = arguments.get("scale", 1.0)
        shift = arguments.get("shift", 0.0)
        output = arguments.get("output", "")
        
        if not audio or not pattern:
            return [TextContent(type="text", text="Error: audio and pattern are required")]
        
        try:
            # Load the audio file
            song = bm.song(audio=audio)
            
            # Generate beatmap if not cached
            song.beatmap_generate()
            
            # Apply scale and shift
            song.beatmap_shift(shift)
            song.beatmap_scale(scale)
            
            # Perform beat swapping
            result = song.beatswap(pattern=pattern)
            
            # Generate output path if not specified
            if not output:
                input_path = Path(audio)
                output = f"beatswapped_{input_path.stem}.wav"
            
            # Write the result
            song.write(output=output)
            
            return [TextContent(
                type="text", 
                text=f"✅ Successfully beatswapped audio using pattern '{pattern}'. Output saved to: {output}"
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"❌ Error during beatswap: {str(e)}")]
    
    async def handle_generate_beatmap(self, arguments: dict) -> List[TextContent]:
        """Handle beatmap generation."""
        audio = arguments.get("audio")
        caching = arguments.get("caching", True)
        variable_bpm = arguments.get("variable_bpm", False)
        
        if not audio:
            return [TextContent(type="text", text="❌ Error: audio file path is required")]
        
        try:
            song = bm.song(audio=audio)
            
            # Choose the appropriate library
            lib = 'madmom.BeatDetectionProcessor' if not variable_bpm else 'madmom.BeatTrackingProcessor'
            
            # Generate beatmap
            song.beatmap_generate(lib=lib, caching=caching)
            
            beat_count = len(song.beatmap)
            duration = len(song.audio[0]) / song.sr if hasattr(song, 'audio') else 180  # Mock duration
            estimated_bpm = (beat_count / duration) * 60
            
            return [TextContent(
                type="text",
                text=f"✅ Generated beatmap for {audio}: {beat_count} beats detected, estimated BPM: {estimated_bpm:.1f}"
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"❌ Error generating beatmap: {str(e)}")]
    
    async def handle_slice_audio_by_beats(self, arguments: dict) -> List[TextContent]:
        """Handle audio slicing by beats."""
        audio = arguments.get("audio")
        beat_start = arguments.get("beat_start")
        beat_end = arguments.get("beat_end")
        
        if not audio or beat_start is None:
            return [TextContent(type="text", text="❌ Error: audio and beat_start are required")]
        
        try:
            song = bm.song(audio=audio)
            song.beatmap_generate()
            
            if beat_end is not None:
                sliced_audio = song[beat_start:beat_end]
                slice_desc = f"beats {beat_start} to {beat_end}"
            else:
                sliced_audio = song[beat_start]
                slice_desc = f"beat {beat_start}"
            
            # Generate output path
            input_path = Path(audio)
            output = f"sliced_{slice_desc.replace(' ', '_')}_{input_path.stem}.wav"
            
            # Mock save the sliced audio
            logger.info(f"Mock: Saving sliced audio to {output}")
            
            return [TextContent(
                type="text",
                text=f"✅ Successfully sliced {slice_desc} from {audio}. Output saved to: {output}"
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"❌ Error slicing audio: {str(e)}")]
    
    async def handle_apply_audio_effects(self, arguments: dict) -> List[TextContent]:
        """Handle audio effects application."""
        audio = arguments.get("audio")
        pattern = arguments.get("pattern")
        effects = arguments.get("effects")
        
        if not audio or not pattern:
            return [TextContent(type="text", text="❌ Error: audio and pattern are required")]
        
        try:
            song = bm.song(audio=audio)
            song.beatmap_generate()
            
            # Apply effects using the pattern
            result = song.beatswap(pattern=pattern, effects=effects)
            
            # Generate output path
            input_path = Path(audio)
            output = f"effected_{input_path.stem}.wav"
            
            song.write(output=output)
            
            return [TextContent(
                type="text",
                text=f"✅ Successfully applied effects using pattern '{pattern}'. Output saved to: {output}"
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"❌ Error applying effects: {str(e)}")]
    
    async def handle_mix_multiple_songs(self, arguments: dict) -> List[TextContent]:
        """Handle mixing multiple songs."""
        primary_audio = arguments.get("primary_audio")
        secondary_audio = arguments.get("secondary_audio")
        pattern = arguments.get("pattern")
        output = arguments.get("output", "")
        
        if not all([primary_audio, secondary_audio, pattern]):
            return [TextContent(type="text", text="❌ Error: primary_audio, secondary_audio, and pattern are required")]
        
        try:
            # Load primary song
            primary_song = bm.song(audio=primary_audio)
            primary_song.beatmap_generate()
            
            # Load secondary song as sample
            secondary_song = bm.song(audio=secondary_audio)
            secondary_song.beatmap_generate()
            
            samples = {"song2": secondary_song}
            
            # Mix using pattern
            result = primary_song.beatswap(pattern=pattern, samples=samples)
            
            # Generate output path if not specified
            if not output:
                primary_path = Path(primary_audio)
                secondary_path = Path(secondary_audio)
                output = f"mixed_{primary_path.stem}_{secondary_path.stem}.wav"
            
            primary_song.write(output=output)
            
            return [TextContent(
                type="text",
                text=f"✅ Successfully mixed songs using pattern '{pattern}'. Output saved to: {output}"
            )]
        except Exception as e:
            return [TextContent(type="text", text=f"❌ Error mixing songs: {str(e)}")]

    async def run(self):
        """Run the MCP server."""
        logger.info("Starting MCP Beat Manipulator Server...")
        logger.info("Server ready to accept connections!")
        logger.info("Tools available: beatswap, generate_beatmap, slice_audio_by_beats, apply_audio_effects, mix_multiple_songs")
        
        async with stdio.stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="beat-manipulator-mcp",
                    server_version="0.1.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )

async def main():
    """Main entry point for the MCP server."""
    print("🎵 MCP Beat Manipulator Demo Server")
    print("=" * 50)
    print("This is a demo version that simulates beat manipulation.")
    print("For full functionality, install the actual beat-manipulator dependencies.")
    print("=" * 50)
    
    server = BeatManipulatorMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())