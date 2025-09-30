# MCP Beat Manipulator Server

A Model Context Protocol (MCP) server that exposes the powerful beat manipulation functionality of the [beat-manipulator](https://github.com/djwugee/beat-manipulator) repository as MCP tools. This enables AI applications like Claude Desktop to perform AI-powered beat swapping and audio manipulation through a standardized protocol.

## Features

- **Beat Swapping**: Rearrange beats using pattern syntax
- **Beat Detection**: Automatic beatmap generation using madmom library
- **Audio Effects**: Apply effects like speed changes, reverse, bitcrush, and more
- **Audio Slicing**: Extract specific beats or beat ranges
- **Multi-song Mixing**: Mix multiple songs using beat manipulation patterns
- **Pattern-based Processing**: Complex pattern syntax for advanced beat manipulation

## Architecture

This MCP server follows the Model Context Protocol specification to provide:

- **Tools**: Functions that AI applications can call to manipulate audio
- **Standardized Communication**: JSON-RPC 2.0 over stdio transport
- **Capability Negotiation**: Dynamic feature discovery and negotiation
- **Error Handling**: Robust error reporting and recovery

## Installation

### Prerequisites

- Python 3.8 or higher
- FFmpeg (for audio file handling)
- CUDA-capable GPU (optional, for faster processing)

### Install Dependencies

```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y ffmpeg libsndfile1

# Install Python dependencies
pip install -r requirements.txt
```

### Install MCP Server

```bash
# Install the MCP server
pip install -e .

# Or install from source
git clone <repository-url>
cd mcp-beat-manipulator
pip install -e .
```

## Usage

### Running the Server

```bash
# Run the MCP server
mcp-beat-manipulator

# Or run directly with Python
python mcp_beat_manipulator_server.py
```

### Integration with Claude Desktop

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "beat-manipulator": {
      "command": "mcp-beat-manipulator",
      "env": {
        "PYTHONPATH": "/path/to/beat-manipulator"
      }
    }
  }
}
```

### Available Tools

#### 1. Beat Swapping (`beatswap`)

Rearrange beats in an audio file using pattern syntax.

**Parameters**:
- `audio`: Path to audio file
- `pattern`: Beat swapping pattern (e.g., "1,3,2,4" swaps 2nd and 3rd beats)
- `scale`: Scale factor for beatmap (optional, default: 1.0)
- `shift`: Shift beatmap in beats (optional, default: 0.0)
- `output`: Output file path (optional, auto-generated)

**Example Pattern Syntax**:
- `"1,3,2,4"`: Swap 2nd and 3rd beats every 4 beats
- `"1,2,3,4!"`: Remove 4th beat every 4 beats
- `"1s2"`: Play 1st beat at 2x speed
- `"1r"`: Reverse 1st beat
- `"1;2"`: Play 1st and 2nd beats simultaneously

#### 2. Beatmap Generation (`generate_beatmap`)

Generate beatmap for an audio file using AI-powered beat detection.

**Parameters**:
- `audio`: Path to audio file
- `caching`: Enable beatmap caching (optional, default: true)
- `variable_bpm`: Use variable BPM detection (optional, default: false)

#### 3. Audio Slicing (`slice_audio_by_beats`)

Extract specific beats or beat ranges from audio.

**Parameters**:
- `audio`: Path to audio file
- `beat_start`: Starting beat number (1-indexed)
- `beat_end`: Ending beat number (optional, can be fractional)

#### 4. Audio Effects (`apply_audio_effects`)

Apply audio effects using pattern syntax.

**Parameters**:
- `audio`: Path to audio file
- `pattern`: Pattern with effects (e.g., "1s2r" for speed and reverse)
- `effects`: Custom effects dictionary (optional)

**Available Effects**:
- `s`: Speed (e.g., "1s2" = 2x speed)
- `r`: Reverse (e.g., "1r" = reversed)
- `v`: Volume (e.g., "1v0.5" = 50% volume)
- `d`: Downsample (e.g., "1d8" = 8-bit sound)
- `b`: Bitcrush (e.g., "1b4" = bitcrushed)
- `g`: Gradient/highpass (e.g., "1g1")
- `c`: Channel manipulation

#### 5. Multi-song Mixing (`mix_multiple_songs`)

Mix multiple songs using beat manipulation patterns.

**Parameters**:
- `primary_audio`: Path to primary audio file
- `secondary_audio`: Path to secondary audio file
- `pattern`: Mixing pattern (use `[song2]` syntax)
- `output`: Output file path (optional)

**Example**: `"1,[song2]2,3,[song2]4" alternates beats between songs`

## Pattern Syntax Guide

### Basic Patterns
- `"1,2,3,4"`: Play beats in order
- `"1,3,2,4"`: Swap 2nd and 3rd beats
- `"1,4"`: Skip 2nd and 3rd beats

### Beat Slicing
- `"1>0.5"`: First half of 1st beat
- `"1<0.5"`: Second half of 1st beat
- `"1.25:1.5"`: Specific time range

### Effects
- `"1s2"`: 2x speed
- `"1r"`: Reversed
- `"1v0.5"`: 50% volume
- `"1d8"`: 8-bit downsample
- `"1b4"`: Bitcrush
- `"1g1"`: Gradient/highpass

### Operators
- `,`: Sequential (put next to previous)
- `;`: Simultaneous (mix together)
- `^`: Multiply (fake sidechain)
- `$`: Add with sidechain

### Advanced Features
- `"i"`: Current position variable
- `"#"`: Shuffle groups (e.g., "1#1,2#2")
- `"!"`: Skip beat but count for pattern size
- `"?"`: Don't count for pattern size
- `"@"`: Random beat selection

## Examples

### Basic Beat Swapping
```
Use the beatswap tool with:
- audio: "/path/to/song.mp3"
- pattern: "1,3,2,4"
```

### Apply Effects
```
Use the apply_audio_effects tool with:
- audio: "/path/to/song.mp3" 
- pattern: "1s2r,2d8,3v0.5,4b4"
```

### Mix Two Songs
```
Use the mix_multiple_songs tool with:
- primary_audio: "/path/to/song1.mp3"
- secondary_audio: "/path/to/song2.mp3"
- pattern: "1,[song2]2,3,[song2]4"
```

### Extract Beat Range
```
Use the slice_audio_by_beats tool with:
- audio: "/path/to/song.mp3"
- beat_start: 16
- beat_end: 32
```

## Configuration

### Environment Variables

- `PYTHONPATH`: Path to beat-manipulator module
- `MCP_LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)

### Performance Tuning

- Use CUDA-capable GPU for faster beat detection
- Enable caching for repeated processing of same files
- Use fixed BPM detection for faster processing when tempo is consistent

## Troubleshooting

### Common Issues

1. **Import Error**: Ensure beat_manipulator is in PYTHONPATH
2. **Audio File Not Found**: Check file paths are absolute and accessible
3. **Processing Slow**: Enable GPU acceleration or reduce audio file size
4. **Memory Issues**: Process shorter audio segments or increase available memory

### Debug Mode

Run with debug logging:
```bash
MCP_LOG_LEVEL=DEBUG mcp-beat-manipulator
```

## Development

### Project Structure

```
mcp-beat-manipulator/
├── mcp_beat_manipulator_server.py  # Main MCP server
├── setup.py                        # Package setup
├── requirements.txt                # Python dependencies
├── README.md                       # This file
└── examples/                       # Usage examples
```

### Adding New Tools

1. Add tool definition in `handle_list_tools()`
2. Implement handler in `handle_call_tool()`
3. Add specific handler method
4. Update documentation

### Testing

```bash
# Test the server directly
python mcp_beat_manipulator_server.py

# Test with MCP inspector
npx @modelcontextprotocol/inspector
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Original [beat-manipulator](https://github.com/djwugee/beat-manipulator) by inikishev
- [madmom](https://github.com/CPJKU/madmom) library for beat detection
- [MCP Specification](https://modelcontextprotocol.io) by Anthropic

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Open an issue on GitHub
- Review the original beat-manipulator documentation