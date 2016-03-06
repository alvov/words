(function() {
    'use strict';

    var RATIO_THRESHOLD = 0.17;
    var DEFAULT_SQUARE_WORD = '??';
    var CHOOSE_IMAGE = 'choose image';
    var CLASSNAME_VIDEO_ON = 'video-on';
    var ERRORS = {
        PermissionDeniedError: 'You blocked using your camera for this page',
        PermissionDismissedError: 'You restricted using your camera for this page',
        default: 'Video capturing is not available on your device'
    };
    var IMAGE_MODE = 0;
    var VIDEO_MODE = 1;
    var CAMERA_CONSTRAINTS = {
        audio: false,
        video: {
            width: 1280,
            height: 720,
            frameRate: {
                max: 30
            }
        },
        facingMode: 'user'
    };

    var imageNode = new Image();
    var videoNode;
    var outputCanvasNode = document.getElementById('canvas');
    var outputContext = outputCanvasNode.getContext('2d');

    var sourceCanvasNode = document.createElement('canvas');
    var sourceContext = sourceCanvasNode.getContext('2d');
    // single initiation for better GC
    var sourceImageData;
    // cached canvas size
    var sourceCanvasSize;
    var words;

    var state = {
        isLoading: null,
        preset: null,
        source: null,
        imageSrc: null,
        imageName: null,
        color: null,
        shades: null,
        bgColor: null,
        gridSize: null,
        font: null,
        vocabulary: null,
        downloadLink: null
    };

    // form events
    (function() {
        var formNode = document.forms['mf-controls'];

        // prepare presets
        window.examples.forEach(function(example, i) {
            example.source = 0;
            example.imageName = example.imageSrc.split('/').pop();
            var optionNode = document.createElement('option');
            optionNode.value = i;
            optionNode.textContent = example.preset;
            formNode['mf-preset'].appendChild(optionNode);
        });

        // prepare sources
        var sourceOptions = [[IMAGE_MODE, 'image']];
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            videoNode = document.createElement('video');
            videoNode.onloadedmetadata = function() {
                setCanvasSize({
                    width: videoNode.videoWidth,
                    height: videoNode.videoHeight
                });
                videoCapturingLoop();
            };
            sourceOptions.push([VIDEO_MODE, 'video'])
        } else {
            sourceOptions.push([IMAGE_MODE, 'video (not supported)'])
        }
        sourceOptions.forEach(function(option) {
            var optionNode = document.createElement('option');
            optionNode.value = option[0];
            optionNode.textContent = option[1];
            formNode['mf-source'].appendChild(optionNode);
        });

        formNode['mf-preset'].addEventListener('change', function(e) {
            setPreset(Number(e.target.value));
        });

        formNode['mf-source'].addEventListener('change', function(e) {
            var value = Number(e.target.value);
            setState({ source: value, preset: '' });
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

        formNode['mf-color'].addEventListener('input', function(e) {
            setState({ color: e.target.valueAsNumber, preset: '' });
        });

        formNode['mf-shades'].addEventListener('input', function(e) {
            setState({ shades: e.target.valueAsNumber, preset: '' });
        });

        formNode['mf-bg-color'].addEventListener('input', function(e) {
            setState({ bgColor: e.target.valueAsNumber, preset: '' });
        });

        formNode['mf-font'].addEventListener('input', function(e) {
            setState({ font: e.target.value.trim(), preset: '' });
        });

        formNode['mf-vocabulary'].addEventListener('input', function(e) {
            setState({ vocabulary: e.target.value.trim(), preset: '' });
        });

        formNode.addEventListener('submit', function(e) {
            e.preventDefault();
            if (state.source === IMAGE_MODE && formNode.checkValidity() && imageNode.src && imageNode.width && imageNode.height) {
                setState({ isLoading: true });
                setCanvasSize(imageNode);
                renderImage({ src: imageNode });
                setState({ isLoading: false });
            }
        });

        document.links['download-link'].addEventListener('click', function(e) {
            e.target.href = outputCanvasNode.toDataURL();
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

            if ('source' in oldState) {
                formNode['mf-source'].value = state.source;
                formNode.classList.toggle(CLASSNAME_VIDEO_ON, state.source === VIDEO_MODE);
                if (state.source === VIDEO_MODE) {
                    navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
                        .then(function(mediaStream) {
                            videoNode.src = window.URL.createObjectURL(mediaStream);
                            videoNode.play();
                        })
                        .catch(function(err) {
                            var message;
                            if (err && err.message) {
                                message = err.message;
                            } else if (err && err.name) {
                                message = ERRORS[err.name] || ERRORS.default;
                            } else {
                                message = ERRORS.default;
                            }
                            alert(message);
                            setState({ source: IMAGE_MODE });
                        });
                } else if (videoNode) {
                    videoNode.src = '';
                }
            }

            if ('imageName' in oldState) {
                if (formNode['mf-image-input'].labels) {
                    formNode['mf-image-input'].labels[0].textContent = state.imageName;
                } else {
                    // firefox, wtf? ಠ_ಠ
                    formNode.querySelector('[for="mf-image-input"]').textContent = state.imageName;
                }
            }

            if ('imageSrc' in oldState) {
                imageNode.src = state.imageSrc;
            }

            if ('gridSize' in oldState) {
                formNode['mf-grid-size'].value = state.gridSize;
                formNode['mf-grid-size-output'].value = state.gridSize;
                if (state.source === VIDEO_MODE) {
                    setCanvasSize({
                        width: videoNode.videoWidth,
                        height: videoNode.videoHeight
                    });
                }
            }

            if ('color' in oldState) {
                formNode['mf-color'].value = state.color;
                formNode['mf-color-output'].style.backgroundColor = getColorByParams(state.color);
            }

            if ('shades' in oldState) {
                formNode['mf-shades'].value = state.shades;
                formNode['mf-shades-output'].value = state.shades;
            }

            if ('bgColor' in oldState) {
                formNode['mf-bg-color'].value = state.bgColor;
                formNode['mf-bg-color-output'].style.backgroundColor = getColorByParams(state.bgColor);
            }

            if ('font' in oldState) {
                if (formNode['mf-font'].value !== state.font) {
                    formNode['mf-font'].value = state.font;
                    formVocabularyMap();
                }
            }

            if ('vocabulary' in oldState) {
                formNode['mf-vocabulary'].value = state.vocabulary;
                formVocabularyMap();
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
            var newImageNode = new Image();
            newImageNode.onload = function() {
                setCanvasSize(imageNode);
                renderImage({ src: imageNode });
                setState({ isLoading: false });
            };
            newImageNode.src = window.examples[index].imageSrc;
        }
    })();

    /**
     * Launches camera source rendering
     */
    function videoCapturingLoop() {
        if (state.source !== VIDEO_MODE) {
            return;
        }
        requestAnimationFrame(videoCapturingLoop);
        renderImage({ src: videoNode });
    }

    /**
     * Renders text-image on canvas
     * @param params
     */
    function renderImage(params) {
        // fill canvas background
        var backgroundColorString = getColorByParams(state.bgColor);
        outputContext.fillStyle = backgroundColorString;
        outputContext.fillRect(0, 0, outputCanvasNode.width, outputCanvasNode.height);
        document.body.style.backgroundColor = backgroundColorString;

        outputContext.textAlign = 'center';
        outputContext.textBaseline = 'middle';

        // put image to canvas
        sourceContext.drawImage(params.src, 0, 0, sourceCanvasSize.width, sourceCanvasSize.height);
        sourceImageData = sourceContext.getImageData(0, 0, sourceCanvasSize.width, sourceCanvasSize.height).data;

        // greyscale, threshold and construct grid array
        var gridCells = [];
        for (var gridRow = 0; gridRow < sourceCanvasSize.height; gridRow++) {
            var gridRowCells = [];
            for (var gridCol = 0; gridCol < sourceCanvasSize.width; gridCol++) {
                var i = (gridRow * sourceCanvasSize.width + gridCol) * 4;
                gridRowCells.push(thresholdLightness(
                    (sourceImageData[i] + sourceImageData[i + 1] + sourceImageData[i + 2]) / 3 * 100 / 255
                ));
            }
            gridCells.push(gridRowCells);
        }

        var excludedCells = {};
        var wordsTimesUsed = {};
        for (gridRow = 0; gridRow < gridCells.length; gridRow++) {
            for (gridCol = 0; gridCol < gridCells[gridRow].length; gridCol++) {
                if (excludedCells[gridRow + '_' + gridCol] || gridCells[gridRow][gridCol] === 100) {
                    continue;
                }
                var currentCell = gridCells[gridRow][gridCol];
                // find all rectangles
                var currentCellRectangles = [];
                var rightNeighbourIndex = gridCol;
                var maxRow = gridCells.length;
                while (
                    rightNeighbourIndex < gridCells[gridRow].length &&
                    gridCells[gridRow][rightNeighbourIndex] === currentCell &&
                    !excludedCells[gridRow + '_' + rightNeighbourIndex]
                ) {
                    var bottomNeighbourIndex = gridRow;
                    while (
                        bottomNeighbourIndex < maxRow &&
                        gridCells[bottomNeighbourIndex][rightNeighbourIndex] === currentCell
                    ) {
                        // add new rect
                        var newRect = {
                            pos: [[gridRow, gridCol], [bottomNeighbourIndex, rightNeighbourIndex]],
                            color: currentCell,
                            orient: 'h'
                        };
                        newRect.square = (rightNeighbourIndex - gridCol + 1) * (bottomNeighbourIndex - gridRow + 1);
                        newRect.ratio = (newRect.pos[1][1] + 1 - newRect.pos[0][1]) /
                            (newRect.pos[1][0] + 1 - newRect.pos[0][0]);
                        currentCellRectangles.push(newRect);
                        // add the same rectangle but "rotated"
                        currentCellRectangles.push({
                            pos: newRect.pos,
                            color: newRect.color,
                            orient: 'v',
                            square: newRect.square,
                            ratio: 1 / newRect.ratio
                        });
                        bottomNeighbourIndex++;
                    }
                    maxRow = bottomNeighbourIndex;
                    rightNeighbourIndex++;
                }

                var candidates = [];
                var nrm = Object.create(helpers.normalization);
                nrm.reset('ratioDelta');
                nrm.reset('square');
                nrm.reset('wordFreq');
                for (i = 0; i < currentCellRectangles.length; i++) {
                    var prevRatioDelta = Infinity;
                    for (var j = 0; j < words.length; j++) {
                        var ratioDelta = Math.abs(words[j].ratio - currentCellRectangles[i].ratio);
                        if (ratioDelta <= RATIO_THRESHOLD) {
                            var currentWordFreq = wordsTimesUsed[words[j].word] || 0;
                            candidates.push({
                                pos: currentCellRectangles[i].pos,
                                square: currentCellRectangles[i].square,
                                color: currentCellRectangles[i].color,
                                ratioDelta: ratioDelta,
                                word: words[j].word,
                                wordFreq: currentWordFreq,
                                orient: currentCellRectangles[i].orient,
                                ranks: []
                            });
                            nrm.push('ratioDelta', ratioDelta);
                            nrm.push('square', currentCellRectangles[i].square);
                            nrm.push('wordFreq', currentWordFreq);
                        } else if (ratioDelta > prevRatioDelta) {
                            // break if there's no more suitable word in the sorted list
                            break;
                        }
                        prevRatioDelta = ratioDelta;
                    }
                }
                if (!candidates.length) {
                    candidates.push({
                        pos: currentCellRectangles[0].pos,
                        square: currentCellRectangles[0].square,
                        color: currentCellRectangles[0].color,
                        ratioDelta: 1,
                        word: DEFAULT_SQUARE_WORD,
                        wordFreq: wordsTimesUsed[DEFAULT_SQUARE_WORD] || 0,
                        orient: 'h',
                        ranks: []
                    });
                }

                // choose rectangle
                var winner;
                if (candidates.length > 1) {
                    nrm.done('ratioDelta');
                    nrm.done('square');
                    nrm.done('wordFreq');
                    var minRank = Infinity;
                    var candidatesWithMinRank = [];
                    for (i = 0; i < candidates.length; i++) {
                        var rank = 0.2 * nrm.normalize('ratioDelta', candidates[i].ratioDelta) +
                            0.4 * nrm.normalize('square', candidates[i].square) +
                            0.4 * nrm.normalize('wordFreq', candidates[i].wordFreq);
                        if (minRank > rank) {
                            candidatesWithMinRank = [candidates[i]];
                            minRank = rank;
                        }
                        if (minRank === rank) {
                            candidatesWithMinRank.push(candidates[i]);
                        }
                    }
                    if (
                        candidatesWithMinRank.length === 1 ||
                        state.source === VIDEO_MODE // no random blinking for video mode
                    ) {
                        winner = candidatesWithMinRank[0];
                    } else {
                        winner = candidatesWithMinRank[Math.floor(Math.random() * candidatesWithMinRank.length)];
                    }
                } else {
                    winner = candidates[0];
                }

                var selectedRect = {
                    top: winner.pos[0][0] * state.gridSize,
                    right: winner.pos[1][1] * state.gridSize + state.gridSize,
                    bottom: winner.pos[1][0] * state.gridSize + state.gridSize,
                    left: winner.pos[0][1] * state.gridSize
                };
                if (wordsTimesUsed[winner.word]) {
                    wordsTimesUsed[winner.word]++;
                } else {
                    wordsTimesUsed[winner.word] = 1;
                }

                // place word
                outputContext.fillStyle = getColorByParams(state.color, winner.color);
                if (winner.orient === 'h') {
                    outputContext.font = (selectedRect.bottom - selectedRect.top) + 'px ' + state.font;
                    outputContext.fillText(
                        winner.word,
                        (selectedRect.right - selectedRect.left) / 2 + selectedRect.left,
                        (selectedRect.bottom - selectedRect.top) / 2 + selectedRect.top
                    );
                } else {
                    outputContext.font = (selectedRect.right - selectedRect.left) + 'px ' + state.font;
                    outputContext.save();
                    outputContext.translate(selectedRect.right, selectedRect.top);
                    outputContext.rotate(Math.PI / 2);
                    outputContext.fillText(
                        winner.word,
                        (selectedRect.bottom - selectedRect.top) / 2,
                        (selectedRect.right - selectedRect.left) / 2
                    );
                    outputContext.restore();
                }

                // exclude grid cells
                for (
                    var selectedRectRow = winner.pos[0][0];
                    selectedRectRow <= winner.pos[1][0];
                    selectedRectRow++
                ) {
                    for (
                        var selectedRectCol = winner.pos[0][1];
                        selectedRectCol <= winner.pos[1][1];
                        selectedRectCol++
                    ) {
                        excludedCells[selectedRectRow + '_' + selectedRectCol] = true;
                    }
                }
            }
        }
    }

    /**
     * (Re)sets needed canvases sizes
     * @param {Object} sourceSize
     */
    function setCanvasSize(sourceSize) {
        var size = {};
        if (window.innerWidth / window.innerHeight > sourceSize.width / sourceSize.height) {
            size.height = window.innerHeight;
            size.width = Math.floor(window.innerHeight / sourceSize.height * sourceSize.width)
        } else {
            size.width = window.innerWidth;
            size.height = Math.floor(window.innerWidth / sourceSize.width * sourceSize.height)
        }

        outputCanvasNode.width = size.width;
        outputCanvasNode.height = size.height;
        sourceCanvasSize = {
            width: Math.round(size.width / state.gridSize),
            height: Math.round(size.height / state.gridSize)
        };
        sourceCanvasNode.width = sourceCanvasSize.width;
        sourceCanvasNode.height = sourceCanvasSize.height;
    }

    /**
     * Forms sorted list of words with calculated size proportions depending on selected font and grid size
     */
    function formVocabularyMap() {
        var measurementFontSize = 10;
        outputContext.font = measurementFontSize + 'px ' + state.font;
        words = state.vocabulary.trim().split(' ')
            .map(function(word) {
                return {
                    ratio: outputContext.measureText(word).width / measurementFontSize,
                    word: word
                };
            })
            .sort(function(a, b) {
                return a.ratio - b.ratio;
            });
    }

    /**
     * Returns closest threshold level for a given lightness value
     * @param {number} lightness
     * @returns {number}
     */
    function thresholdLightness(lightness) {
        var colorThresholdWindow = 100 / (state.shades - 1);
        for (var i = 0, level = 0; i < state.shades - 1; i++, level += colorThresholdWindow) {
            if (lightness < level + colorThresholdWindow / 2) {
                return Math.floor(level);
            }
        }
        return 100;
    }

    /**
     * Returns css color string for given hue and lightness
     * @param {number} h
     * @param {number} l
     * @returns {string}
     */
    function getColorByParams(h, l) {
        var s;
        if (l === undefined) {
            l = 0;
        }
        if (h === -1) {
            // grayscale
            s = 0;
            h = 0;
        } else if (h === 360) {
            s = 100;
            l = 100;
        } else {
            // full saturation
            s = 100;
            // adjust lightness not to have dark colors (min l is 50)
            l = Math.floor(l / 2) + 50;
        }
        return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
    }
})();
