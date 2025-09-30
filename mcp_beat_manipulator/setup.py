#!/usr/bin/env python3
"""
Setup script for MCP Beat Manipulator Server
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="mcp-beat-manipulator",
    version="0.1.0",
    author="MCP Beat Manipulator Team",
    author_email="",
    description="MCP (Model Context Protocol) Server for Beat Manipulator - AI-powered beat swapping and audio manipulation",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/djwugee/beat-manipulator",
    py_modules=["mcp_beat_manipulator_server"],
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "mcp-beat-manipulator=mcp_beat_manipulator_server:main",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Multimedia :: Sound/Audio :: Analysis",
        "Topic :: Multimedia :: Sound/Audio :: Editors",
    ],
    python_requires=">=3.8",
)