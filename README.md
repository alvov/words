# Words
What it does is reproduce an image with a set of words which may or may not be associated with it.

Check out this example of my photo represented with a bunch of JS keywords/operators:

![Example - me wordified](/examples/me/me-wordified.png)

One can choose a **preset example** or upload his own image or use camera as input source (if supported).
 
The available controls for now are:

* **source** - select between image you can upload or video stream from camera (if supported).
The more contrasty the source is, the better
* **grid size** - adjusts how detailed the output will be
* **color** - controls the hue of output
* **shades** - controls the quantity of color shades
* **background color** - in case you'll feel creative
* **font** - needs to be a valid css font-family value
* **vocabulary** - space-separated words to be used for the output. The more words of different lengths, the better.
**Note:** as there will likely be a lot of small "square" areas on your source image,
make sure you have short enough words (like "yo", or "lol", or ";-)") in your vocabulary that can suit those areas.
If you don't provide any, "??" will be used instead.

All images used for example presets belong to their respective owners.