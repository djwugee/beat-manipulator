#!/usr/bin/env python3
"""
Demonstration of MCP Beat Manipulator Server
This shows how the server works and what tools are available.
"""

import json

def demo_mcp_tools():
    """Demonstrate the MCP tools with example usage."""
    
    print("🎵 MCP Beat Manipulator Server - Tool Demonstration")
    print("=" * 60)
    
    # Define the available tools with examples
    tools = {
        "beatswap": {
            "description": "Swap beats in an audio file using pattern syntax",
            "parameters": {
                "audio": "Path to audio file",
                "pattern": "Beat swapping pattern",
                "scale": "Scale factor (optional)",
                "shift": "Shift in beats (optional)",
                "output": "Output path (optional)"
            },
            "examples": [
                {
                    "name": "Basic Beat Swapping",
                    "pattern": "1,3,2,4",
                    "description": "Swap 2nd and 3rd beats every 4 beats"
                },
                {
                    "name": "Remove Every 4th Beat", 
                    "pattern": "1,2,3,4!",
                    "description": "Play 3 beats, skip the 4th"
                },
                {
                    "name": "Speed and Reverse Effects",
                    "pattern": "1s2r,2s0.5,3r",
                    "description": "1st beat: 2x speed + reverse, 2nd beat: half speed, 3rd beat: reverse"
                }
            ]
        },
        "generate_beatmap": {
            "description": "Generate beatmap using AI-powered beat detection",
            "parameters": {
                "audio": "Path to audio file",
                "caching": "Enable caching (default: true)",
                "variable_bpm": "Use variable BPM detection (default: false)"
            },
            "examples": [
                {
                    "name": "Basic Beat Detection",
                    "params": {"caching": True, "variable_bpm": False},
                    "description": "Generate beatmap with fixed tempo detection"
                },
                {
                    "name": "Variable BPM Detection",
                    "params": {"caching": True, "variable_bpm": True},
                    "description": "Handle songs with tempo changes"
                }
            ]
        },
        "slice_audio_by_beats": {
            "description": "Extract specific beats or beat ranges",
            "parameters": {
                "audio": "Path to audio file",
                "beat_start": "Starting beat number (1-indexed)",
                "beat_end": "Ending beat number (optional, can be fractional)"
            },
            "examples": [
                {
                    "name": "Extract Single Beat",
                    "params": {"beat_start": 16},
                    "description": "Extract the 16th beat"
                },
                {
                    "name": "Extract Beat Range",
                    "params": {"beat_start": 8, "beat_end": 16},
                    "description": "Extract beats 8 through 16"
                },
                {
                    "name": "Extract Partial Beat",
                    "params": {"beat_start": 4.5, "beat_end": 8.5},
                    "description": "Extract from halfway through beat 4 to halfway through beat 8"
                }
            ]
        },
        "apply_audio_effects": {
            "description": "Apply audio effects using pattern syntax",
            "parameters": {
                "audio": "Path to audio file",
                "pattern": "Pattern with effects",
                "effects": "Custom effects dictionary (optional)"
            },
            "examples": [
                {
                    "name": "Multiple Effects Chain",
                    "pattern": "1s2rd8,2v0.5b4,3g1",
                    "description": "Complex effects: speed+reverse+downsample, volume+bitcrush, gradient"
                },
                {
                    "name": "8-Bit Sound",
                    "pattern": "1d8,2d8,3d8,4d8",
                    "description": "Apply 8-bit downsample to all beats"
                }
            ]
        },
        "mix_multiple_songs": {
            "description": "Mix multiple songs using beat manipulation patterns",
            "parameters": {
                "primary_audio": "Path to primary audio file",
                "secondary_audio": "Path to secondary audio file",
                "pattern": "Mixing pattern using [song2] syntax",
                "output": "Output file path (optional)"
            },
            "examples": [
                {
                    "name": "Alternate Beats",
                    "pattern": "1,[song2]2,3,[song2]4",
                    "description": "Alternate between primary and secondary song beats"
                },
                {
                    "name": "Layer Beats",
                    "pattern": "1;[song2]1,2;[song2]2",
                    "description": "Layer beats from both songs simultaneously"
                }
            ]
        }
    }
    
    # Display each tool
    for tool_name, tool_info in tools.items():
        print(f"\n🔧 {tool_name.upper()}")
        print(f"   Description: {tool_info['description']}")
        print(f"   Parameters:")
        for param, desc in tool_info['parameters'].items():
            print(f"     • {param}: {desc}")
        
        if 'examples' in tool_info:
            print(f"   Examples:")
            for i, example in enumerate(tool_info['examples'], 1):
                print(f"     {i}. {example['name']}")
                if 'pattern' in example:
                    print(f"        Pattern: {example['pattern']}")
                if 'params' in example:
                    print(f"        Parameters: {json.dumps(example['params'], indent=10)}")
                print(f"        Description: {example['description']}")
                print()
    
    print("\n" + "=" * 60)
    print("📝 PATTERN SYNTAX REFERENCE")
    print("=" * 60)
    
    syntax_examples = [
        (",", "Sequential", "1,2,3,4 → Play beats in order"),
        (";", "Simultaneous", "1;2 → Play both beats together (mixed)"),
        ("s", "Speed", "1s2 → 2x speed, 1s0.5 → half speed"),
        ("r", "Reverse", "1r → Reverse audio"),
        ("v", "Volume", "1v0.5 → 50% volume, 1v2 → 200% volume"),
        ("d", "Downsample", "1d8 → 8-bit sound effect"),
        ("b", "Bitcrush", "1b4 → Bitcrush effect"),
        ("g", "Gradient", "1g1 → Highpass filter effect"),
        ("c", "Channel", "1c → Swap channels, 1c0 → Left only"),
        ("!", "Skip Beat", "1,2,3,4! → Skip 4th beat but count it"),
        ("?", "Ignore for Pattern Size", "1,2,3,8? → Pattern repeats every 3 beats"),
        ("@", "Random Selection", "@1_4_0.5 → Random beat from 1-4 in 0.5 steps"),
        ("#", "Shuffle Groups", "1#1,2#1,3#1 → Shuffle beats in group 1"),
        ("i", "Position Variable", "i,i+1,i+2 → Current position-based pattern")
    ]
    
    for symbol, name, description in syntax_examples:
        print(f"  {symbol:2} → {name:15} | {description}")
    
    print("\n" + "=" * 60)
    print("🚀 USAGE EXAMPLES")
    print("=" * 60)
    
    usage_examples = [
        {
            "name": "Create a Swing Beat",
            "pattern": "1,2.5,3,4.5",
            "description": "Offset even beats to create swing feel"
        },
        {
            "name": "Build-up Effect",
            "pattern": "1s1,2s1.1,3s1.2,4s1.3",
            "description": "Gradually increase speed for build-up"
        },
        {
            "name": "Glitch Effect",
            "pattern": "1r,2d8b4,3r,4d8b4",
            "description": "Alternating reverse and heavy glitch effects"
        },
        {
            "name": "Call and Response",
            "pattern": "1,[song2]2,3,[song2]4",
            "description": "Alternate between two songs"
        },
        {
            "name": "Beat Juggling",
            "pattern": "1,2,1,2,3,4,3,4",
            "description": "Repeat beats for juggling effect"
        }
    ]
    
    for i, example in enumerate(usage_examples, 1):
        print(f"\n{i}. {example['name']}")
        print(f"   Pattern: {example['pattern']}")
        print(f"   Effect:  {example['description']}")
    
    print("\n" + "=" * 60)
    print("✅ INTEGRATION READY")
    print("=" * 60)
    print("The MCP server is ready for integration with:")
    print("• Claude Desktop")
    print("• Other MCP clients")
    print("• Custom AI applications")
    print("\nAll tools are accessible via the standardized MCP protocol!")
    print("=" * 60)

if __name__ == "__main__":
    demo_mcp_tools()