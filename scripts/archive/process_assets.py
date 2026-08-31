from PIL import Image, ImageOps
import os

images_dir = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\assets\images"
icon_path = os.path.join(images_dir, "icon.png")
notif_path = os.path.join(images_dir, "notification-icon.png")
favicon_path = os.path.join(images_dir, "favicon.png")

# 1. Generate Notification Icon
# We take icon.png. Since it's an app icon, it might not have an alpha channel mask of the logo (might have a solid background).
# Let's open it.
img = Image.open(icon_path).convert("RGBA")
# For a white logo with transparent background, we'll extract the luminosity, invert it to use as an alpha mask if it's a dark logo on light background.
# Alternatively, to be safe and robust without knowing the exact logo colors:
# We just create a pure white mask of its alpha channel if it has one.
# If the original icon has no transparency, we will make a circular mask and use that as the alpha.
# Actually, the simplest way to get a safe notification icon is a white square with slightly rounded corners if we don't have the original vector.
# But let's try to extract non-white pixels as the alpha mask to make a shape.
r, g, b, a = img.split()
# Create a mask from lightness: pixels that are "dark" become opaque, "light" become transparent
# L = R*0.299 + G*0.587 + B*0.114
gray = img.convert('L')
# Invert it so dark logo on white bg -> white logo on black bg
inverted_gray = ImageOps.invert(gray)

# We will just use the inverted gray as alpha, and a solid white image.
solid_white = Image.new("RGBA", img.size, (255, 255, 255, 255))
solid_white.putalpha(inverted_gray)

# Resize to 96x96
notif_img = solid_white.resize((96, 96), Image.Resampling.LANCZOS)
notif_img.save(notif_path, "PNG")
print("Saved notification-icon.png")

# 2. Resize icon.png to exactly 1024x1024 (No transparency)
icon_1024 = Image.open(icon_path).convert("RGB") # Remove alpha
icon_1024 = icon_1024.resize((1024, 1024), Image.Resampling.LANCZOS)
icon_1024.save(icon_path, "PNG", optimize=True)
print("Resized icon.png to 1024x1024")

# 3. Optimize favicon.png to 192x192
favicon_192 = Image.open(favicon_path).convert("RGBA")
favicon_192 = favicon_192.resize((192, 192), Image.Resampling.LANCZOS)
favicon_192.save(favicon_path, "PNG", optimize=True)
print("Optimized favicon.png to 192x192")

