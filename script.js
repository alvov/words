(function() {
    'use strict';

    var IMAGE_SRC = 'IMG_3660.JPG'; // 'img.jpg'
    var COLOR_LEVELS_NUM = 5;
    var RATIO_THRESHOLD = 0.17;
    var colorThresholdWindow = 255 / (COLOR_LEVELS_NUM + 1);
    var gridSize = 20;
    var FONT_FAMILY = 'Impact, sans-serif';

    var image = new Image();
    image.onload = function() {
        var size = {};
        if (window.innerWidth / window.innerHeight > image.width / image.height) {
            size.height = window.innerHeight;
            size.width = Math.floor(window.innerHeight / image.height * image.width)
        } else {
            size.width = window.innerWidth;
            size.heigth = Math.floor(window.innerWidth / image.width * image.height)
        }
        var defaultContext = getCanvasContext('default-canvas', size);
        var filterContext = getCanvasContext('filter-canvas', size);

        // format vocabulary
        var words = window.vocabulary.trim().split('\n')
            .map(function(word) {
                return {
                    ratio: filterContext.measureText(word).width / 10,
                    word: word
                };
            })
            .sort(function(a, b) {
                return a.ratio - b.ratio;
            });

        defaultContext.drawImage(image, 0, 0, size.width, size.height);
        var defaultImageData = defaultContext.getImageData(0, 0, size.width, size.height);
        var filterImageData = filterContext.createImageData(size.width, size.height);
        // greyscale and threshold
        for (var i = 0; i < defaultImageData.data.length; i += 4) {
            greyScale([
                defaultImageData.data[i],
                defaultImageData.data[i + 1],
                defaultImageData.data[i + 2],
                defaultImageData.data[i + 3]
            ], i, filterImageData);
        }
        // pixelate
        var gridCells = [];
        for (var gridRow = 0; gridRow < size.height; gridRow += gridSize) {
            var gridRowCells = [];
            for (var gridCol = 0; gridCol < size.width; gridCol += gridSize) {
                var gridPixels = [];
                for (var pixelRow = gridRow; (pixelRow < gridRow + gridSize) && (pixelRow < size.height); pixelRow++) {
                    for (var pixelCol = gridCol; (pixelCol < gridCol + gridSize) && (pixelCol < size.width); pixelCol++) {
                        var index = 4 * (pixelCol + pixelRow * size.width);
                        gridPixels.push(index);
                    }
                }
                var meanLightness = getMeanLightness(gridPixels, filterImageData.data);
                gridPixels.forEach(function(i) {
                    for (var j = 0; j < 3; j++) {
                        filterImageData.data[i + j] = meanLightness;
                    }
                });
                gridRowCells.push({
                    color: meanLightness
                });
            }
            gridCells.push(gridRowCells);
        }
        filterContext.textAlign = 'center';
        filterContext.textBaseline = 'middle';

        var excludedCells = {};
        for (gridRow = 0; gridRow < gridCells.length; gridRow++) {
            for (gridCol = 0; gridCol < gridCells[gridRow].length; gridCol++) {
                if (excludedCells[gridRow + '_' + gridCol] || gridCells[gridRow][gridCol].color === 255) {
                    continue;
                }
                var currentCell = gridCells[gridRow][gridCol];
                // find all rectangles
                var currentCellRectangles = [];
                var rightNeighbourIndex = gridCol;
                var maxRow = gridCells.length;
                while (
                    rightNeighbourIndex < gridCells[gridRow].length &&
                    gridCells[gridRow][rightNeighbourIndex].color === currentCell.color
                ) {
                    var bottomNeighbourIndex = gridRow;
                    while (
                        bottomNeighbourIndex < maxRow &&
                        gridCells[bottomNeighbourIndex][rightNeighbourIndex].color === currentCell.color &&
                        !excludedCells[bottomNeighbourIndex + '_' + rightNeighbourIndex]
                    ) {
                        // add new rect
                        var newRect = {
                            pos: [[gridRow, gridCol], [bottomNeighbourIndex, rightNeighbourIndex]],
                            color: currentCell.color
                        };
                        newRect.ratio = [(newRect.pos[1][1] + 1 - newRect.pos[0][1]) /
                            (newRect.pos[1][0] + 1 - newRect.pos[0][0])];
                        newRect.ratio[1] = 1 / newRect.ratio[0];
                        currentCellRectangles.push(newRect);
                        bottomNeighbourIndex++;
                    }
                    maxRow = bottomNeighbourIndex;
                    rightNeighbourIndex++;
                }
                // choose rectangle
                var minRatioDeltas = [];
                for (i = 0; i < currentCellRectangles.length; i++) {
                    var minRatioDelta = {
                        value: Infinity
                    };
                    for (var j = 0; j < words.length; j++) {
                        for (var k = 0; k < 2; k++) {
                            var ratioDelta = Math.abs(words[j].ratio - currentCellRectangles[i].ratio[k]);
                            if (minRatioDelta.value > ratioDelta) {
                                minRatioDelta.value = ratioDelta;
                                minRatioDelta.rect = currentCellRectangles[i];
                                minRatioDelta.word = words[j];
                                minRatioDelta.orient = k ? 'v' : 'h';
                            }
                        }
                    }
                    minRatioDeltas.push(minRatioDelta);
                }
                minRatioDeltas = minRatioDeltas.sort(function(a, b) {
                    return a.value - b.value;
                });
                var maxValidRatioValueIndex = minRatioDeltas.findIndex(function(ratioDelta) {
                    if (ratioDelta.value > RATIO_THRESHOLD) {
                        return true;
                    }
                });
                if (maxValidRatioValueIndex === -1) {
                    maxValidRatioValueIndex = minRatioDeltas.length;
                }
                var selectedRectIndex = Math.floor(Math.random() * maxValidRatioValueIndex);
                var selectedRect = {
                    top: minRatioDeltas[selectedRectIndex].rect.pos[0][0] * gridSize,
                    right: minRatioDeltas[selectedRectIndex].rect.pos[1][1] * gridSize + gridSize,
                    bottom: minRatioDeltas[selectedRectIndex].rect.pos[1][0] * gridSize + gridSize,
                    left: minRatioDeltas[selectedRectIndex].rect.pos[0][1] * gridSize
                };
                // place word
                filterContext.fillStyle = 'rgb(' + new Array(3).fill(minRatioDeltas[selectedRectIndex].rect.color).join() + ')';
                if (minRatioDeltas[selectedRectIndex].orient === 'h') {
                    filterContext.font = (selectedRect.bottom - selectedRect.top) + 'px ' + FONT_FAMILY;
                    filterContext.fillText(
                        minRatioDeltas[selectedRectIndex].word.word,
                        (selectedRect.right - selectedRect.left) / 2 + selectedRect.left,
                        (selectedRect.bottom - selectedRect.top) / 2 + selectedRect.top
                    );
                } else {
                    filterContext.save();
                    filterContext.translate(selectedRect.right, selectedRect.top);
                    filterContext.rotate(Math.PI / 2);
                    filterContext.font = (selectedRect.right - selectedRect.left) + 'px ' + FONT_FAMILY;
                    filterContext.fillText(
                        minRatioDeltas[selectedRectIndex].word.word,
                        (selectedRect.bottom - selectedRect.top) / 2,
                        (selectedRect.right - selectedRect.left) / 2
                    );
                    filterContext.restore();
                }

                // exclude grid cells
                for (
                    var selectedRectRow = minRatioDeltas[selectedRectIndex].rect.pos[0][0];
                    selectedRectRow <= minRatioDeltas[selectedRectIndex].rect.pos[1][0];
                    selectedRectRow++
                ) {
                    for (
                        var selectedRectCol = minRatioDeltas[selectedRectIndex].rect.pos[0][1];
                        selectedRectCol <= minRatioDeltas[selectedRectIndex].rect.pos[1][1];
                        selectedRectCol++
                    ) {
                        excludedCells[selectedRectRow + '_' + selectedRectCol] = true;
                    }
                }
            }
        }
    };
    image.src = IMAGE_SRC;

    /**
     * Returns canvas context with defined width/height
     * @param {string} id
     * @param {Object} size
     * @returns {CanvasRenderingContext2D}
     */
    function getCanvasContext(id, size) {
        var canvasNode = document.getElementById(id);
        canvasNode.width = size.width;
        canvasNode.height = size.height;
        return canvasNode.getContext('2d');
    }

    /**
     * Transforms <imageData> pixel to grey scale
     * @param {Array} rgba
     * @param {number} i - pixel index
     * @param {Object} imageData
     */
    function greyScale(rgba, i, imageData) {
        var lightness = Math.floor((rgba[0] + rgba[1] + rgba[2]) / 3);
        lightness = thresholdLightness(lightness);
        for (var j = 0; j < 3; j++) {
            imageData.data[i + j] = lightness;
        }
        imageData.data[i + 3] = rgba[3];
    }

    /**
     * Returns closest threshold level for a given lightness value
     * @param {number} lightness
     * @returns {number}
     */
    function thresholdLightness(lightness) {
        for (var i = 0, level = 0; i <= COLOR_LEVELS_NUM; i++, level += colorThresholdWindow) {
            if (lightness < level + colorThresholdWindow / 2) {
                return Math.floor(level);
            }
        }
        return 255;
    }

    /**
     * Returns mean lightness value for given pixels
     * @param {Array} pixels
     * @param {Object} imageData
     * @returns {number}
     */
    function getMeanLightness(pixels, imageData) {
        var meanLightness = pixels.reduce(function(sum, pixelIndex) {
            return sum + imageData[pixelIndex];
        }, 0) / pixels.length;
        return thresholdLightness(meanLightness);
    }
})();
