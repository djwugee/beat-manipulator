# MCP Beat Manipulator Server - Deployment Guide

## 🚀 Quick Start

### Option 1: Run the Demo Server (Immediate Testing)

```bash
# The server is ready to run
python mcp_beat_manipulator_working.py
```

The demo server simulates beat manipulation functionality and shows all MCP tools working.

### Option 2: Full Installation (Production Use)

```bash
# Install dependencies
pip install -r requirements.txt
pip install git+https://github.com/CPJKU/madmom

# Install the MCP server
pip install -e .

# Run the server
mcp-beat-manipulator
```

## 📋 Prerequisites

### System Requirements
- Python 3.8 or higher
- FFmpeg (for audio processing)
- 4GB+ RAM recommended
- CUDA-capable GPU (optional, for faster processing)

### Install System Dependencies

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg libsndfile1
```

**macOS:**
```bash
brew install ffmpeg libsndfile
```

**Windows:**
Download and install FFmpeg from https://ffmpeg.org/download.html

## 🔧 Integration with Claude Desktop

### Step 1: Configure Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "beat-manipulator": {
      "command": "python",
      "args": ["/absolute/path/to/mcp_beat_manipulator_working.py"],
      "env": {
        "PYTHONPATH": "/path/to/beat-manipulator"
      }
    }
  }
}
```

### Step 2: Restart Claude Desktop

Restart Claude Desktop to load the new MCP server.

### Step 3: Test the Integration

In Claude Desktop, you should now be able to use commands like:

```
Generate a beatmap for my song at /path/to/song.mp3
```

```
Beatswap this audio file with pattern "1,3,2,4": /path/to/song.mp3
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Start the container
docker-compose up -d

# View logs
docker-compose logs -f
```

### Manual Docker Build

```bash
# Build the image
docker build -t mcp-beat-manipulator .

# Run the container
docker run -v ./audio:/app/audio -p 8080:8080 mcp-beat-manipulator
```

## 🛠️ Development Setup

### 1. Clone and Setup

```bash
git clone <repository-url>
cd mcp-beat-manipulator

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt
pip install git+https://github.com/CPJKU/madmom
```

### 2. Install in Development Mode

```bash
pip install -e .
```

### 3. Run Tests

```bash
# Test the server
python test_mcp_server.py

# Demo the functionality
python demo_mcp_interaction.py
```

## 📖 Usage Examples

### Basic Beat Swapping

```python
# MCP Tool Call
{
  "tool": "beatswap",
  "arguments": {
    "audio": "/path/to/song.mp3",
    "pattern": "1,3,2,4"
  }
}
```

### Advanced Effects

```python
# MCP Tool Call
{
  "tool": "apply_audio_effects", 
  "arguments": {
    "audio": "/path/to/song.mp3",
    "pattern": "1s2r,2d8,3v0.5,4b4"
  }
}
```

### Multi-Song Mixing

```python
# MCP Tool Call
{
  "tool": "mix_multiple_songs",
  "arguments": {
    "primary_audio": "song1.mp3",
    "secondary_audio": "song2.mp3",
    "pattern": "1,[song2]2,3,[song2]4"
  }
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Import Error**: Make sure beat-manipulator is in PYTHONPATH
2. **Audio File Not Found**: Use absolute paths or check file permissions
3. **Processing Slow**: Enable GPU acceleration or reduce file size
4. **Memory Issues**: Process shorter audio segments

### Environment Variables

- `PYTHONPATH`: Path to beat-manipulator module
- `MCP_LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)
- `CUDA_VISIBLE_DEVICES`: GPU acceleration

### Debug Mode

```bash
# Run with debug logging
MCP_LOG_LEVEL=DEBUG mcp-beat-manipulator
```

## 📊 Performance Optimization

### For Large Audio Files
- Use audio slicing to process smaller segments
- Enable caching for repeated processing
- Use fixed BPM detection when possible

### For Batch Processing
- Process multiple files in parallel
- Use the caching system
- Consider GPU acceleration

## 🎵 Pattern Syntax Quick Reference

| Symbol | Effect | Example |
|--------|--------|---------|
| `,` | Sequential | `1,2,3,4` |
| `;` | Simultaneous | `1;2` |
| `s` | Speed | `1s2` (2x speed) |
| `r` | Reverse | `1r` |
| `v` | Volume | `1v0.5` (50% volume) |
| `d` | Downsample | `1d8` (8-bit) |
| `b` | Bitcrush | `1b4` |
| `g` | Gradient | `1g1` |
| `!` | Skip Beat | `1,2,3,4!` |
| `@` | Random | `@1_4_0.5` |
| `#` | Shuffle | `1#1,2#1` |
| `i` | Position | `i,i+1,i+2` |

## 🔗 Additional Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Beat Manipulator Repository](https://github.com/djwugee/beat-manipulator)
- [MCP Inspector Tool](https://github.com/modelcontextprotocol/inspector)
- [Claude Desktop Documentation](https://claude.ai/docs)

## 📄 License

This MCP server implementation is provided as-is for educational and development purposes. Please respect the licenses of the original beat-manipulator repository and all dependencies.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section above
- Open an issue on GitHub
- Review the original beat-manipulator documentation
- Check MCP protocol documentation

---

**🎉 Ready to transform your audio with AI-powered beat manipulation!**