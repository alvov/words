(function() {
    'use strict';

    var RATIO_THRESHOLD = 0.17;
    var DEFAULT_SQUARE_WORD = '??';
    var CHOOSE_IMAGE = 'choose image';

    var image = new Image();
    var canvasNode = document.getElementById('canvas');

    var state = {
        isLoading: null,
        preset: null,
        imageSrc: null,
        imageName: null,
        colors: null,
        gridSize: null,
        font: null,
        vocabulary: null,
        downloadLink: null
    };

    // form events
    (function() {
        var formNode = document.forms['mf-controls'];

        window.examples.forEach(function(example, i) {
            var optionNode = document.createElement('option');
            optionNode.value = i;
            optionNode.innerText = example.preset;
            formNode['mf-preset'].appendChild(optionNode);
        });

        formNode['mf-preset'].addEventListener('change', function(e) {
            setPreset(Number(e.target.value));
        });

        formNode['mf-image-input'].addEventListener('change', function(e) {
            if (/image/.test(e.target.files[0].type)) {
                var reader = new FileReader();
                var fileName = e.target.files[0].name;
                reader.onload = function(e) {
                    setState({ imageSrc: e.target.result, imageName: fileName, preset: '' });
                };
                reader.readAsDataURL(e.target.files[0]);
            } else {
                setState({ imageSrc: '', imageName: CHOOSE_IMAGE, preset: '' });
            }
        });

        formNode['mf-grid-size'].addEventListener('input', function(e) {
            setState({ gridSize: e.target.valueAsNumber, preset: '' });
        });

        formNode['mf-colors'].addEventListener('input', function(e) {
            setState({ colors: e.target.valueAsNumber, preset: '' });
        });

        formNode['mf-font'].addEventListener('input', function(e) {
            setState({ font: e.target.value.trim(), preset: '' });
        });

        formNode['mf-vocabulary'].addEventListener('input', function(e) {
            setState({ vocabulary: e.target.value.trim(), preset: '' });
        });

        formNode.addEventListener('submit', function(e) {
            e.preventDefault();
            if (formNode.checkValidity() && image.src && image.width && image.height) {
                setState({ isLoading: true });
                renderImage();
                setState({ isLoading: false });
            }
        });

        document.links['download-link'].addEventListener('click', function(e) {
            e.target.href = canvasNode.toDataURL();
            e.target.download = 'wordy-image.png';
        });

        setPreset(0);

        /**
         * Updates the state object and triggers rendering
         * @param {Object} data
         */
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

        /**
         * Updates DOM depending on changed state
         * @param {Object} oldState
         */
        function render(oldState) {
            if ('preset' in oldState) {
                formNode['mf-preset'].value = window.examples.findIndex(function(example) {
                    return example.preset === state.preset;
                });
            }

            if ('imageName' in oldState) {
                formNode['mf-image-input'].labels[0].innerText = state.imageName;
            }

            if ('imageSrc' in oldState) {
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

            if ('font' in oldState) {
                if (formNode['mf-font'].value !== state.font) {
                    formNode['mf-font'].value = state.font;
                }
            }

            if ('vocabulary' in oldState) {
                formNode['mf-vocabulary'].value = state.vocabulary;
            }

            if ('isLoading' in oldState) {
                formNode.classList.toggle('is-loading', Boolean(state.isLoading));
            }
        }

        /**
         * Sets preset state value and triggers image rendering
         * @param {number} index
         */
        function setPreset(index) {
            setState(Object.assign({}, window.examples[index], {
                isLoading: true
            }));
            var image = new Image();
            image.onload = function() {
                renderImage();
                setState({ isLoading: false });
            };
            image.src = window.examples[index].imageSrc;
        }
    })();

    /**
     * Renders text-image on canvas
     */
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
        var wordsTimesUsed = {};
        for (gridRow = 0; gridRow < gridCells.length; gridRow++) {
            for (gridCol = 0; gridCol < gridCells[gridRow].length; gridCol++) {
                if (excludedCells[gridRow + '_' + gridCol] || gridCells[gridRow][gridCol].color === 100) {
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
                        newRect.square = (rightNeighbourIndex - gridCol + 1) * (bottomNeighbourIndex - gridRow + 1);
                        newRect.ratio = [(newRect.pos[1][1] + 1 - newRect.pos[0][1]) /
                            (newRect.pos[1][0] + 1 - newRect.pos[0][0])];
                        newRect.ratio[1] = 1 / newRect.ratio[0];
                        currentCellRectangles.push(newRect);
                        bottomNeighbourIndex++;
                    }
                    maxRow = bottomNeighbourIndex;
                    rightNeighbourIndex++;
                }
                var candidates = [];
                for (i = 0; i < currentCellRectangles.length; i++) {
                    for (var j = 0; j < words.length; j++) {
                        for (var k = 0; k < 2; k++) {
                            var ratioDelta = Math.abs(words[j].ratio - currentCellRectangles[i].ratio[k]);
                            if (ratioDelta <= RATIO_THRESHOLD) {
                                candidates.push(Object.assign({}, currentCellRectangles[i], {
                                    ratioDelta: ratioDelta,
                                    word: words[j].word,
                                    wordFreq: wordsTimesUsed[words[j].word] || 0,
                                    orient: k ? 'v' : 'h',
                                    ranks: []
                                }));
                            }
                        }
                    }
                }
                if (!candidates.length) {
                    candidates.push(Object.assign({}, currentCellRectangles[0], {
                        ratioDelta: 1,
                        word: DEFAULT_SQUARE_WORD,
                        wordFreq: wordsTimesUsed[DEFAULT_SQUARE_WORD] || 0,
                        orient: 'h',
                        ranks: []
                    }));
                }

                // choose rectangle
                candidates = sortByProp(candidates, 'ratioDelta');
                // ratioDelta rank
                setRanks(candidates, 'ratioDelta', 0);
                // square rank
                candidates = sortByProp(candidates, 'square', -1);
                setRanks(candidates, 'square', 1);
                // frequency rank
                candidates = sortByProp(candidates, 'wordFreq');
                setRanks(candidates, 'wordFreq', 2);
                for (i = 0; i < candidates.length; i++) {
                    candidates[i].ranks = 0.2 * candidates[i].ranks[0] +
                        0.4 * candidates[i].ranks[1] + 0.4 * candidates[i].ranks[2];
                }
                candidates = sortByProp(candidates, 'ranks');

                var sameRankIndexLimit = candidates.findIndex(function(candidate, i, arr) {
                    if (candidate.ranks !== arr[0].ranks) {
                        return candidate;
                    }
                });
                var selectedRectIndex;
                if (Math.abs(sameRankIndexLimit) === 1) {
                    selectedRectIndex = 0;
                } else {
                    selectedRectIndex = Math.floor(Math.random() * sameRankIndexLimit);
                }
                var selectedRect = {
                    top: candidates[selectedRectIndex].pos[0][0] * state.gridSize,
                    right: candidates[selectedRectIndex].pos[1][1] * state.gridSize + state.gridSize,
                    bottom: candidates[selectedRectIndex].pos[1][0] * state.gridSize + state.gridSize,
                    left: candidates[selectedRectIndex].pos[0][1] * state.gridSize
                };
                if (wordsTimesUsed[candidates[selectedRectIndex].word]) {
                    wordsTimesUsed[candidates[selectedRectIndex].word]++;
                } else {
                    wordsTimesUsed[candidates[selectedRectIndex].word] = 1;
                }

                // place word
                filterContext.fillStyle = 'hsl(0, 0%, ' + candidates[selectedRectIndex].color + '%)';
                if (candidates[selectedRectIndex].orient === 'h') {
                    filterContext.font = (selectedRect.bottom - selectedRect.top) + 'px ' + state.font;
                    filterContext.fillText(
                        candidates[selectedRectIndex].word,
                        (selectedRect.right - selectedRect.left) / 2 + selectedRect.left,
                        (selectedRect.bottom - selectedRect.top) / 2 + selectedRect.top
                    );
                } else {
                    filterContext.save();
                    filterContext.translate(selectedRect.right, selectedRect.top);
                    filterContext.rotate(Math.PI / 2);
                    filterContext.font = (selectedRect.right - selectedRect.left) + 'px ' + state.font;
                    filterContext.fillText(
                        candidates[selectedRectIndex].word,
                        (selectedRect.bottom - selectedRect.top) / 2,
                        (selectedRect.right - selectedRect.left) / 2
                    );
                    filterContext.restore();
                }

                // exclude grid cells
                for (
                    var selectedRectRow = candidates[selectedRectIndex].pos[0][0];
                    selectedRectRow <= candidates[selectedRectIndex].pos[1][0];
                    selectedRectRow++
                ) {
                    for (
                        var selectedRectCol = candidates[selectedRectIndex].pos[0][1];
                        selectedRectCol <= candidates[selectedRectIndex].pos[1][1];
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
     * Returns pixel lightness value (0 - 100)
     * @param {Array} rgb
     */
    function greyScale(rgb) {
        var lightness = Math.floor((rgb[0] + rgb[1] + rgb[2]) / 3) * 100 / 255;
        return thresholdLightness(lightness);
    }

    /**
     * Returns closest threshold level for a given lightness value
     * @param {number} lightness
     * @returns {number}
     */
    function thresholdLightness(lightness) {
        var colorThresholdWindow = 100 / (state.colors - 1);
        for (var i = 0, level = 0; i < state.colors; i++, level += colorThresholdWindow) {
            if (lightness < level + colorThresholdWindow / 2) {
                return Math.floor(level);
            }
        }
        return 100;
    }

    /**
     * Sets the rank depending on given key. Ranks are not unique
     * @param {Array} arr
     * @param {string} key
     * @param {number} rankIndex
     */
    function setRanks(arr, key, rankIndex) {
        for (var i = 0; i < arr.length; i++) {
            if (i) {
                if (arr[i][key] === arr[i - 1][key]) {
                    arr[i].ranks[rankIndex] = arr[i - 1].ranks[rankIndex];
                } else {
                    arr[i].ranks[rankIndex] = arr[i - 1].ranks[rankIndex] + 1;
                }
            } else {
                arr[i].ranks[rankIndex] = 0;
            }
        }
    }

    /**
     * Sorts array by given property key
     * @param {Array} arr
     * @param {string} key
     * @param {number} order
     * @returns {Array}
     */
    function sortByProp(arr, key, order) {
        order = order || 1;
        return arr.sort(function(a, b) {
            return order * (a[key] - b[key]);
        });
    }
})();
