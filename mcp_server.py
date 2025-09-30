import asyncio
from typing import Any, Optional
import yaml
from mcp.server.fastmcp import FastMCP
import beat_manipulator as bm
import os

# Initialize FastMCP server
mcp = FastMCP("beat_manipulator")

# Load presets
with open("beat_manipulator/presets.yaml", "r") as f:
    presets = yaml.safe_load(f)

preset_names = list(presets.keys())

@mcp.tool()
async def beatswap(
    audio_path: str,
    pattern: Optional[str] = None,
    preset: Optional[str] = None,
    scale: float = 1.0,
    shift: float = 0.0,
) -> str:
    """
    Beatswaps an audio file using a pattern or a preset.

    Args:
        audio_path: Path to the audio file.
        pattern: The beatswap pattern to use.
        preset: The name of the preset to use.
        scale: The scale of the beatmap.
        shift: The shift of the beatmap.
    """
    if not os.path.exists(audio_path):
        return f"Error: Audio file not found at {audio_path}"

    if preset and preset in presets:
        pattern_to_use = presets[preset]["pattern"]
        if "scale" in presets[preset]:
            scale_str = str(presets[preset]["scale"])
            if isinstance(presets[preset]["scale"], list):
                scale = float(scale_str.split(",")[0])
            else:
                scale = float(scale_str)

    elif pattern:
        pattern_to_use = pattern
    else:
        return "Error: You must provide either a pattern or a valid preset."

    try:
        output_path = bm.beatswap(
            song=audio_path,
            pattern=pattern_to_use,
            scale=scale,
            shift=shift,
            output="",  # Let the library handle the output path
        )
        return f"Success! Beatswapped audio saved to: {output_path}"
    except Exception as e:
        return f"An error occurred during beatswapping: {e}"


@mcp.tool()
async def image_generate(audio_path: str, scale: float = 1.0, shift: float = 0.0) -> str:
    """
    Generates an image from an audio file.

    Args:
        audio_path: Path to the audio file.
        scale: The scale of the beatmap.
        shift: The shift of the beatmap.
    """
    if not os.path.exists(audio_path):
        return f"Error: Audio file not found at {audio_path}"
    try:
        output_path = bm.image(song=audio_path, scale=scale, shift=shift)
        return f"Success! Image saved to: {output_path}"
    except Exception as e:
        return f"An error occurred during image generation: {e}"


@mcp.tool()
async def osu_generate(audio_path: str) -> str:
    """
    Generates an osu! beatmap from an audio file.

    Args:
        audio_path: Path to the audio file.
    """
    if not os.path.exists(audio_path):
        return f"Error: Audio file not found at {audio_path}"
    try:
        output_path = bm.osu.generate(song=audio_path)
        return f"Success! osu! beatmap saved to: {output_path}"
    except Exception as e:
        return f"An error occurred during osu! beatmap generation: {e}"


def main():
    # Initialize and run the server
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()