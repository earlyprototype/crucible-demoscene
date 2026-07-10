#!/usr/bin/env python3
"""
Cortex Intro Animation
Extracted from the Project Crucible v0.7 UI system
A themed ASCII art intro screen with pixel dissolve animation
"""

import os
import random
import sys
import textwrap
import time


def get_safe_terminal_width():
    """Get terminal width with safe fallback and margin handling."""
    try:
        terminal_width = os.get_terminal_size().columns
        # Ensure we have at least 40 columns for a minimal box, cap at 120
        return max(40, min(120, terminal_width - 2))  # -2 for terminal margins
    except OSError:
        return 78  # Safe default that works in most terminals


def system_messages(messages, spacing=True):
    """Display multiple sequential system messages in one box with > [SYSTEM] prefix and streaming effect."""
    color_code = "\033[92m"
    reset_code = "\033[0m"
    box_width = get_safe_terminal_width()

    # Calculate text width for the message content
    prefix = "> [SYSTEM] "
    text_width = box_width - len(prefix) - 3  # -3 for borders and padding

    # Create the box with streaming
    print(f"\n{color_code}┌{'─' * (box_width - 2)}┐{reset_code}")

    for msg_index, message in enumerate(messages):
        if msg_index > 0 and spacing:
            # Add blank line between messages (only if spacing is enabled)
            empty_line = " " * (box_width - 2)
            print(f"{color_code}│{empty_line}│{reset_code}")

        # Wrap the message if it's too long
        wrapped_lines = textwrap.wrap(message, width=text_width)

        for i, line in enumerate(wrapped_lines):
            if i == 0:
                # First line gets the [SYSTEM] prefix
                content = f"{prefix}{line}"
            else:
                # Subsequent lines are indented to align with the first line
                content = f"{' ' * len(prefix)}{line}"

            # Pad the content to fill the box width
            padded_content = content.ljust(box_width - 2)
            print(f"{color_code}│{padded_content}│{reset_code}")

    print(f"{color_code}└{'─' * (box_width - 2)}┘{reset_code}")


def display_intro():
    """Displays the themed ASCII art intro screen with a boot-up animation."""
    green_code = "\033[92m"
    reset_code = "\033[0m"

    cortex_art = [
        "   ██████╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗",
        "  ██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝",
        "  ██║     ██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ ",
        "  ██║     ██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ ",
        "  ╚██████╗╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗",
        "   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝   ",
    ]

    # --- "Pixel Dissolve" Animation ---

    os.system("cls" if os.name == "nt" else "clear")

    # 1. Pre-calculate box dimensions and static parts
    height = len(cortex_art)
    width = len(cortex_art[0]) if height > 0 else 0
    box_width = width + 4  # 2 for padding, 2 for borders

    top_border = f"{green_code}┌{'─' * (box_width - 2)}┐{reset_code}"
    separator = f"{green_code}├{'─' * (box_width - 2)}┤{reset_code}"

    # Create a blank version of the footer for the initial animations
    blank_footer_line = " " * (box_width - 4)
    blank_framed_footer = f"{green_code}│ {blank_footer_line} │{reset_code}"

    bottom_border = f"{green_code}└{'─' * (box_width - 2)}┘{reset_code}"

    # 2. Create a "pixel map" of the target art
    pixel_map = []
    for r, row in enumerate(cortex_art):
        for c, char in enumerate(row):
            if char != " ":
                pixel_map.append((r, c, char))
    random.shuffle(pixel_map)

    # 3. Setup the animation canvas
    # This canvas will hold the final, revealed logo pixels
    logo_canvas = [[" " for _ in range(width)] for _ in range(height)]

    # 4. The animation loops
    revealed_pixels = 0
    # Make the reveal a bit slower and smoother
    pixels_per_frame = len(pixel_map) // 45
    if pixels_per_frame == 0:
        pixels_per_frame = 1

    # Main reveal loop
    while revealed_pixels < len(pixel_map):
        # Reveal a new batch of pixels onto the logo canvas
        for _i in range(pixels_per_frame):
            if revealed_pixels < len(pixel_map):
                r, c, char = pixel_map[revealed_pixels]
                logo_canvas[r][c] = char
                revealed_pixels += 1

        # Create a temporary display canvas for this frame and fill with noise
        display_canvas = [row[:] for row in logo_canvas]
        for r in range(height):
            for c in range(width):
                if display_canvas[r][c] == " ":
                    display_canvas[r][c] = random.choice(["0", "1", " "])

        # --- Redraw the entire framed scene each frame ---
        print("\033[H", end="")  # Move cursor to top left
        print(top_border)
        for row in display_canvas:
            padded_line = "".join(row).ljust(width)
            print(f"{green_code}│ {padded_line} │{reset_code}")
        print(separator)
        print(blank_framed_footer)  # Use blank footer during animation
        print(bottom_border)
        sys.stdout.flush()
        # --- End redraw ---

        time.sleep(0.05)

    # --- Intermediate clean frame to fix visual glitch ---
    # This ensures any reveal artifacts are wiped before the sizzle starts.
    print("\033[H", end="")  # Move cursor to top left
    print(top_border)
    for row in logo_canvas:
        padded_line = "".join(row).ljust(width)
        print(f"{green_code}│ {padded_line} │{reset_code}")
    print(separator)
    print(blank_framed_footer)
    print(bottom_border)
    sys.stdout.flush()
    time.sleep(0.1)

    # Post-reveal "sizzle" animation loop
    sizzle_frames = 18  # EDIT sizzle effect time
    for _ in range(sizzle_frames):
        display_canvas = [row[:] for row in logo_canvas]
        for r in range(height):
            for c in range(width):
                if display_canvas[r][c] == " ":
                    display_canvas[r][c] = random.choice(["0", "1", " "])

        # --- Redraw the entire framed scene each frame ---
        print("\033[H", end="")  # Move cursor to top left
        print(top_border)
        for row in display_canvas:
            padded_line = "".join(row).ljust(width)
            print(f"{green_code}│ {padded_line} │{reset_code}")
        print(separator)
        print(blank_framed_footer)  # Use blank footer during animation
        print(bottom_border)
        sys.stdout.flush()
        # --- End redraw ---

        time.sleep(0.06)

    # Cleanup loop - "wiping" the random data from top to bottom
    for r_wipe in range(height):
        # In each frame of the wipe, create a fresh display canvas
        display_canvas = [row[:] for row in logo_canvas]

        for r in range(height):
            for c in range(width):
                # If the current pixel is not part of the logo
                if logo_canvas[r][c] == " ":
                    if r < r_wipe:
                        # Rows above the wipe line are cleared
                        display_canvas[r][c] = " "
                    else:
                        # Rows on or below the wipe line are still random
                        display_canvas[r][c] = random.choice(["0", "1", " "])

        # --- Redraw the entire framed scene each frame ---
        print("\033[H", end="")  # Move cursor to top left
        print(top_border)
        for row in display_canvas:
            padded_line = "".join(row).ljust(width)
            print(f"{green_code}│ {padded_line} │{reset_code}")
        print(separator)
        print(blank_framed_footer)  # Use blank footer during animation
        print(bottom_border)
        sys.stdout.flush()
        # --- End redraw ---

        time.sleep(0.12)  # EDIT wipe effect time

    # --- Final Animation: Word-by-word footer reveal ---
    footer_text = "AI Knowledge Injection Protocol"
    words = footer_text.split()
    built_text = ""

    for word in words:
        built_text += word + " "

        # Center the footer text within the available space
        padding = (box_width - 4 - len(built_text.strip())) // 2
        padded_footer_text = (" " * padding + built_text.strip()).ljust(box_width - 4)
        framed_footer = f"{green_code}│ {padded_footer_text} │{reset_code}"

        # Redraw the scene with the updated footer
        print("\033[H", end="")  # Move cursor to top left
        print(top_border)
        for row in logo_canvas:  # Use the clean logo_canvas
            padded_line = "".join(row).ljust(width)
            print(f"{green_code}│ {padded_line} │{reset_code}")
        print(separator)
        print(framed_footer)
        print(bottom_border)
        sys.stdout.flush()

        time.sleep(0.15)  # Pause between words

    # Add a final small delay for effect

    # After the main animation, display the streaming welcome message.
    # Special case: intro box gets two separate [SYSTEM] lines with no spacing
    intro_messages = ["Cortex online.", "Ready?"]
    system_messages(intro_messages, spacing=False)


if __name__ == "__main__":
    """Run the Cortex intro animation when executed directly."""
    print("Starting Cortex Intro Animation...")
    display_intro()
    print("\nAnimation complete. Press Enter to exit...")
    input()
