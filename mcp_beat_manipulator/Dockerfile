FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install madmom from git
RUN pip install git+https://github.com/CPJKU/madmom

# Copy application files
COPY mcp_beat_manipulator_server.py .
COPY setup.py .
COPY README.md .

# Install the MCP server
RUN pip install -e .

# Create directories for audio files
RUN mkdir -p /app/audio/input /app/audio/output /app/audio/cache

# Expose port for HTTP transport (optional)
EXPOSE 8080

# Set environment variables
ENV PYTHONPATH=/app
ENV MCP_LOG_LEVEL=INFO

# Run the MCP server
CMD ["mcp-beat-manipulator"]