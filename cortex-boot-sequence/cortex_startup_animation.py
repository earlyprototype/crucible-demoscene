#!/usr/bin/env python3
"""
Cortex Startup Animation
Extracted from the Project Crucible v0.7 UI system
A themed ASCII art startup screen for LLM initialization
"""

import os
import random
import time


def display_startup_animation():
    """Displays a themed ASCII art startup screen for LLM initialization."""
    blue_code = "\033[94m"  # Blue
    reset_code = "\033[0m"

    startup_art = [
        "   ██████╗ ███████╗ █████╗ ██████╗ ██╗   ██╗",
        "   ██╔══██╗██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝",
        "   ██████╔╝█████╗  ███████║██║  ██║ ╚████╔╝ ",
        "   ██╔══██╗██╔══╝  ██╔══██║██║  ██║  ╚██╔╝  ",
        "   ██║  ██║███████╗██║  ██║██████╔╝   ██║   ",
        "   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝   ",
    ]

    os.system("cls" if os.name == "nt" else "clear")

    height = len(startup_art)
    width = len(startup_art[0]) if height > 0 else 0
    box_width = width + 4

    top_border = f"{blue_code}┌{'─' * (box_width - 2)}┐{reset_code}"
    separator = f"{blue_code}├{'─' * (box_width - 2)}┤{reset_code}"
    " " * (box_width - 4)
    bottom_border = f"{blue_code}└{'─' * (box_width - 2)}┘{reset_code}"

    pixel_map = []
    for r, row in enumerate(startup_art):
        for c, char in enumerate(row):
            if char != " ":
                pixel_map.append((r, c, char))
    random.shuffle(pixel_map)

    logo_canvas = [[" " for _ in range(width)] for _ in range(height)]

    revealed_pixels = 0
    pixels_per_frame = len(pixel_map) // 30  # Slightly faster than intro
    if pixels_per_frame == 0:
        pixels_per_frame = 1

    while revealed_pixels < len(pixel_map):
        for _i in range(pixels_per_frame):
            if revealed_pixels < len(pixel_map):
                r, c, char = pixel_map[revealed_pixels]
                logo_canvas[r][c] = char
                revealed_pixels += 1

        display_canvas = [row[:] for row in logo_canvas]
        for r in range(height):
            for c in range(width):
                if display_canvas[r][c] == " ":
                    display_canvas[r][c] = random.choice([" ", "░", "▒", "▓"])

        print(top_border)
        print(
            f"{blue_code}│ {'INITIALIZING CORTEX FRAMEWORK':^{box_width-4}} │{reset_code}"
        )
        print(separator)

        for row in display_canvas:
            print(f"{blue_code}│ {''.join(row)} │{reset_code}")

        print(separator)
        print(
            f"{blue_code}│ {'LLM NEURAL PATHWAYS ACTIVATING':^{box_width-4}} │{reset_code}"
        )
        print(bottom_border)

        time.sleep(0.08)
        if revealed_pixels < len(pixel_map):
            os.system("cls" if os.name == "nt" else "clear")

    # Hold the final frame briefly
    time.sleep(0.5)
    os.system("cls" if os.name == "nt" else "clear")


if __name__ == "__main__":
    """Run the Cortex startup animation when executed directly."""
    print("Starting Cortex Startup Animation...")
    display_startup_animation()
    print("\nAnimation complete. Press Enter to exit...")
    input()
