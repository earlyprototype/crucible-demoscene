#!/usr/bin/env python3
"""
Cortex Outro/Exit Animation
Extracted from the Project Crucible v0.7 UI system
A themed ASCII art exit screen with dissolution animation
"""

import os
import random
import sys
import time


def display_exit_animation():
    """Displays a themed ASCII art exit screen with a boot-up style animation."""
    red_code = "\033[91m"  # Bright Red
    reset_code = "\033[0m"

    dead_art = [
        "   ██████╗ ███████╗ █████╗ ██████╗ ",
        "   ██╔══██╗██╔════╝██╔══██╗██╔══██╗",
        "   ██║  ██║█████╗  ███████║██║  ██║",
        "   ██║  ██║██╔══╝  ██╔══██║██║  ██║",
        "   ██████╔╝███████╗██║  ██║██████╔╝",
        "   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝ ",
    ]

    os.system("cls" if os.name == "nt" else "clear")

    height = len(dead_art)
    width = len(dead_art[0]) if height > 0 else 0
    box_width = width + 4

    top_border = f"{red_code}┌{'─' * (box_width - 2)}┐{reset_code}"
    separator = f"{red_code}├{'─' * (box_width - 2)}┤{reset_code}"
    blank_footer_line = " " * (box_width - 4)
    blank_framed_footer = f"{red_code}│ {blank_footer_line} │{reset_code}"
    bottom_border = f"{red_code}└{'─' * (box_width - 2)}┘{reset_code}"

    pixel_map = []
    for r, row in enumerate(dead_art):
        for c, char in enumerate(row):
            if char != " ":
                pixel_map.append((r, c, char))
    random.shuffle(pixel_map)

    logo_canvas = [[" " for _ in range(width)] for _ in range(height)]

    revealed_pixels = 0
    pixels_per_frame = len(pixel_map) // 45
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
                    display_canvas[r][c] = random.choice(["0", "1", " "])

        print("\033[H", end="")
        print(top_border)
        for row in display_canvas:
            padded_line = "".join(row).ljust(width)
            print(f"{red_code}│ {padded_line} │{reset_code}")
        print(separator)
        print(blank_framed_footer)
        print(bottom_border)
        sys.stdout.flush()

        time.sleep(0.05)

    # Clean frame before footer reveal
    print("\033[H", end="")
    print(top_border)
    for row in logo_canvas:
        padded_line = "".join(row).ljust(width)
        print(f"{red_code}│ {padded_line} │{reset_code}")
    print(separator)
    print(blank_framed_footer)
    print(bottom_border)
    sys.stdout.flush()
    time.sleep(0.1)

    # Footer reveal
    footer_text = "CONNECTION TERMINATED"
    padding = (box_width - 4 - len(footer_text)) // 2
    padded_footer_text = (" " * padding + footer_text).ljust(box_width - 4)
    framed_footer = f"{red_code}│ {padded_footer_text} │{reset_code}"

    print("\033[H", end="")
    print(top_border)
    for row in logo_canvas:
        padded_line = "".join(row).ljust(width)
        print(f"{red_code}│ {padded_line} │{reset_code}")
    print(separator)
    print(framed_footer)
    print(bottom_border)
    sys.stdout.flush()
    time.sleep(1)


def display_exit_art():
    """Displays a thematic exit message."""
    red_code = "\033[91m"
    reset_code = "\033[0m"
    # A simple, clean exit message fits the new theme
    for char in f"\n{red_code}>> TERMINATING CONNECTION <<{reset_code}\n\n":
        sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(0.007)


if __name__ == "__main__":
    """Run the Cortex outro animation when executed directly."""
    print("Starting Cortex Outro Animation...")
    display_exit_animation()
    display_exit_art()
    print("\nAnimation complete. Press Enter to exit...")
    input()
