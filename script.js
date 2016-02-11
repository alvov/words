(function() {
    'use strict';

    var RATIO_THRESHOLD = 0.17;

    var vocabularies = {
        js: vocabulary
    };

    var image = new Image();
    var canvasNode = document.getElementById('canvas');

    var state = {
        imageSrc: null,
        colors: null,
        gridSize: null,
        font: null,
        vocabularyPreset: null,
        vocabulary: null,
        downloadLink: null
    };

    // form events
    (function() {
        var formNode = document.forms['mf-controls'];

        image.addEventListener('load', function() {
            formNode['mf-submit'].disabled = false;
        });

        formNode['mf-image-input'].addEventListener('change', function(e) {
            if (/jpg|jpeg|png|gif/i.test(e.target.value.split('.').pop())) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    setState({ imageSrc: e.target.result });
                };
                reader.readAsDataURL(e.target.files[0]);
            } else {
                setState({ imageSrc: '' });
            }
        });

        formNode['mf-grid-size'].addEventListener('input', function(e) {
            setState({ gridSize: e.target.valueAsNumber });
        });

        formNode['mf-colors'].addEventListener('input', function(e) {
            setState({ colors: e.target.valueAsNumber });
        });

        formNode['mf-font'].addEventListener('input', function(e) {
            setState({ font: e.target.value.trim() });
        });

        formNode['mf-vocabulary-presets'].addEventListener('change', function(e) {
            setState({
                vocabularyPreset: e.target.value,
                vocabulary: e.target.value ?
                    vocabularies[e.target.value] :
                    ''
            });
        });

        formNode['mf-vocabulary'].addEventListener('input', function(e) {
            setState({ vocabulary: e.target.value.trim() });
        });

        formNode.addEventListener('submit', function(e) {
            e.preventDefault();
            if (formNode.checkValidity() && image.src && image.width && image.height) {
                renderImage();
            }
        });

        document.links['download-link'].addEventListener('click', function(e) {
            e.target.href = canvasNode.toDataURL();
            e.target.download = 'wordy-image.png';
        });

        image.onload = function() {
            image.onload = undefined;
            renderImage();
        };

        setState({
            imageSrc: 'IMG_3660.JPG',
            colors: 5,
            gridSize: 20,
            font: 'Impact, sans-serif',
            vocabularyPreset: 'js',
            vocabulary: vocabularies['js']
        });

        function setState(data) {
            var oldState = {};
            Object.keys(data).forEach(function(key) {
                if (state[key] !== data[key]) {
                    oldState[key] = state[key];
                    state[key] = data[key];
                }
            });
            if (Object.keys(oldState).length) {
                render(oldState);
            }
        }

        function render(oldState) {
            if ('imageSrc' in oldState) {
                formNode['mf-submit'].disabled = true;
                image.src = state.imageSrc;
            }

            if ('gridSize' in oldState) {
                formNode['mf-grid-size'].value = state.gridSize;
                formNode['mf-grid-size-output'].value = state.gridSize;
            }

            if ('colors' in oldState) {
                formNode['mf-colors'].value = state.colors;
                formNode['mf-colors-output'].value = state.colors;
            }

            if ('vocabularyPreset' in oldState) {
                formNode['mf-vocabulary-presets'].value = state.vocabularyPreset;
            }

            if ('vocabulary' in oldState) {
                formNode['mf-vocabulary'].value = state.vocabulary;
            }
        }
    })();


    function renderImage() {
        var size = {};
        if (window.innerWidth / window.innerHeight > image.width / image.height) {
            size.height = window.innerHeight;
            size.width = Math.floor(window.innerHeight / image.height * image.width)
        } else {
            size.width = window.innerWidth;
            size.height = Math.floor(window.innerWidth / image.width * image.height)
        }

        var sourceCanvasSize = {
            width: Math.round(size.width / state.gridSize),
            height: Math.round(size.height / state.gridSize)
        };
        var sourceContext = createCanvasContext(sourceCanvasSize);
        var filterContext = createCanvasContext(size, canvasNode);

        // put image to canvas
        sourceContext.drawImage(image, 0, 0, sourceCanvasSize.width, sourceCanvasSize.height);
        var sourceImageData = sourceContext.getImageData(0, 0, sourceCanvasSize.width, sourceCanvasSize.height);
        // format vocabulary
        var words = state.vocabulary.trim().split(' ')
            .map(function(word) {
                return {
                    ratio: filterContext.measureText(word).width / 10,
                    word: word
                };
            })
            .sort(function(a, b) {
                return a.ratio - b.ratio;
            });
        // greyscale, threshold, construct grid array
        var gridCells = [];
        for (var gridRow = 0; gridRow < sourceCanvasSize.height; gridRow++) {
            var gridRowCells = [];
            for (var gridCol = 0; gridCol < sourceCanvasSize.width; gridCol++) {
                var i = (gridRow * sourceCanvasSize.width + gridCol) * 4;
                gridRowCells.push({
                    color: greyScale([
                        sourceImageData.data[i],
                        sourceImageData.data[i + 1],
                        sourceImageData.data[i + 2]
                    ])
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
                    top: minRatioDeltas[selectedRectIndex].rect.pos[0][0] * state.gridSize,
                    right: minRatioDeltas[selectedRectIndex].rect.pos[1][1] * state.gridSize + state.gridSize,
                    bottom: minRatioDeltas[selectedRectIndex].rect.pos[1][0] * state.gridSize + state.gridSize,
                    left: minRatioDeltas[selectedRectIndex].rect.pos[0][1] * state.gridSize
                };
                // place word
                filterContext.fillStyle = 'rgb(' + new Array(3).fill(minRatioDeltas[selectedRectIndex].rect.color).join() + ')';
                if (minRatioDeltas[selectedRectIndex].orient === 'h') {
                    filterContext.font = (selectedRect.bottom - selectedRect.top) + 'px ' + state.font;
                    filterContext.fillText(
                        minRatioDeltas[selectedRectIndex].word.word,
                        (selectedRect.right - selectedRect.left) / 2 + selectedRect.left,
                        (selectedRect.bottom - selectedRect.top) / 2 + selectedRect.top
                    );
                } else {
                    filterContext.save();
                    filterContext.translate(selectedRect.right, selectedRect.top);
                    filterContext.rotate(Math.PI / 2);
                    filterContext.font = (selectedRect.right - selectedRect.left) + 'px ' + state.font;
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
    }

    /**
     * Returns context of created canvas
     * @param {Object} size
     * @param {HTMLElement} canvasNode
     * @returns {CanvasRenderingContext2D}
     */
    function createCanvasContext(size, canvasNode) {
        canvasNode = canvasNode || document.createElement('canvas');
        canvasNode.width = size.width;
        canvasNode.height = size.height;
        return canvasNode.getContext('2d');
    }

    /**
     * Returns pixel lightness value
     * @param {Array} rgb
     */
    function greyScale(rgb) {
        var lightness = Math.floor((rgb[0] + rgb[1] + rgb[2]) / 3);
        return thresholdLightness(lightness);
    }

    /**
     * Returns closest threshold level for a given lightness value
     * @param {number} lightness
     * @returns {number}
     */
    function thresholdLightness(lightness) {
        var colorThresholdWindow = 255 / (state.colors + 1);
        for (var i = 0, level = 0; i <= state.colors; i++, level += colorThresholdWindow) {
            if (lightness < level + colorThresholdWindow / 2) {
                return Math.floor(level);
            }
        }
        return 255;
    }
})();
