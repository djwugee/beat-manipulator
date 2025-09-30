#!/usr/bin/env python3
"""
Example usage of MCP Beat Manipulator Server
This demonstrates how to use the MCP server programmatically.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add the parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp import Client
from mcp_beat_manipulator_server import BeatManipulatorMCPServer

async def test_beatswap():
    """Test the beatswap functionality."""
    print("Testing beatswap functionality...")
    
    # This would normally be handled by the MCP client
    # For demonstration, we'll show the expected workflow
    
    test_params = {
        "audio": "/path/to/test_song.mp3",
        "pattern": "1,3,2,4",
        "scale": 1.0,
        "shift": 0.0,
        "output": "/path/to/output/beatswapped.wav"
    }
    
    print(f"Test parameters: {json.dumps(test_params, indent=2)}")
    print("Expected: Successfully beatswapped audio using pattern '1,3,2,4'")
    print()

async def test_generate_beatmap():
    """Test beatmap generation."""
    print("Testing beatmap generation...")
    
    test_params = {
        "audio": "/path/to/test_song.mp3",
        "caching": True,
        "variable_bpm": False
    }
    
    print(f"Test parameters: {json.dumps(test_params, indent=2)}")
    print("Expected: Generated beatmap with beat count and estimated BPM")
    print()

async def test_slice_audio():
    """Test audio slicing."""
    print("Testing audio slicing...")
    
    test_params = {
        "audio": "/path/to/test_song.mp3",
        "beat_start": 8,
        "beat_end": 16
    }
    
    print(f"Test parameters: {json.dumps(test_params, indent=2)}")
    print("Expected: Sliced audio from beats 8 to 16")
    print()

async def test_effects():
    """Test audio effects."""
    print("Testing audio effects...")
    
    test_params = {
        "audio": "/path/to/test_song.mp3",
        "pattern": "1s2r,2d8,3v0.5,4b4"
    }
    
    print(f"Test parameters: {json.dumps(test_params, indent=2)}")
    print("Expected: Applied multiple effects to different beats")
    print()

async def test_mixing():
    """Test multi-song mixing."""
    print("Testing multi-song mixing...")
    
    test_params = {
        "primary_audio": "/path/to/song1.mp3",
        "secondary_audio": "/path/to/song2.mp3", 
        "pattern": "1,[song2]2,3,[song2]4"
    }
    
    print(f"Test parameters: {json.dumps(test_params, indent=2)}")
    print("Expected: Mixed two songs alternating beats")
    print()

async def main():
    """Run all example tests."""
    print("MCP Beat Manipulator Server - Example Usage")
    print("=" * 50)
    print()
    
    await test_beatswap()
    await test_generate_beatmap()
    await test_slice_audio()
    await test_effects()
    await test_mixing()
    
    print("Pattern Syntax Examples:")
    print("-" * 30)
    print("Basic patterns:")
    print('  "1,2,3,4"          - Play beats in order')
    print('  "1,3,2,4"          - Swap 2nd and 3rd beats')
    print('  "1,4"              - Skip 2nd and 3rd beats')
    print()
    print("Effects:")
    print('  "1s2"              - 2x speed')
    print('  "1r"               - Reversed')
    print('  "1v0.5"            - 50% volume')
    print('  "1d8"              - 8-bit downsample')
    print('  "1b4"              - Bitcrush')
    print()
    print("Operators:")
    print('  "1,2"              - Sequential')
    print('  "1;2"              - Simultaneous (mixed)')
    print('  "1^2"              - Multiply (sidechain)')
    print('  "1$2"              - Add with sidechain')
    print()
    print("Advanced:")
    print('  "1s2r"             - Multiple effects')
    print('  "i,i+1"            - Using position variable')
    print('  "@1_4_0.5"          - Random beat selection')
    print('  "1#1,2#1,3#1"      - Shuffle group')

if __name__ == "__main__":
    asyncio.run(main())