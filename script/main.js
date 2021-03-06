let { h, render, Component } = preact

window.onload = () => {
    render(
        h(Main),
        document.getElementById('main')
    )
}

class Main extends Component {
    constructor() {
        super()

        this.minSize = 20
        this.maxSize = 40

        this.state = {
            size: this.maxSize,
            density: 0.6,
            solved: false,
            drawMode: 'normal',
            history: []
        }

        this.setupBoard = (width, height) => {
            let boardState = Array(width).fill(0).map(() => Array(height).fill(0))
            let guessCells = Array(width).fill(0).map(() => Array(height).fill(0))

            let boardSolution = this.createSolution(width, height)

            let colHints = this.colHints(boardSolution)
            let rowHints = this.rowHints(boardSolution)

            let solvedColHints = null
            let solvedRowHints = null

            let gradient = this.gradient()

            this.setState({ width, height, boardState, boardSolution, colHints, rowHints, gradient, solvedColHints, solvedRowHints, guessCells, solved: false, modalOpen: false })
            this.resize(colHints, rowHints)
        }

        this.createSolution = (width, height) => {
            let boardSolution = Array(height).fill(0).map(() => Array(width).fill(null))

            let randomPoint = (max) => Math.floor(Math.random() * max)

            let addPoint = (x, y) => {
                if (typeof boardSolution[y] !== 'undefined' && typeof boardSolution[y][x] !== 'undefined') {
                    boardSolution[y][x] = 1
                }
            }

            let drawLine = () => { // uses Bresenham's line algorithm
                let x0 = randomPoint(width)
                let y0 = randomPoint(height)
                let x1 = randomPoint(width)
                let y1 = randomPoint(height)

                let dx = Math.abs(x1 - x0)
                let sx = x0 < x1 ? 1 : -1
                let dy = -Math.abs(y1 - y0)
                let sy = y0 < y1 ? 1 : -1
                let err = dx + dy

                while (true) {
                    addPoint(x0, y0)
                    if (x0 === x1 && y0 === y1) {
                        break
                    } else {
                        let e2 = 2 * err
                        if (e2 >= dy) {
                            err += dy
                            x0 += sx
                        }
                        if (e2 <= dx) {
                            err += dx
                            y0 += sy
                        }
                    }
                }
            }

            let drawCircle = () => { // uses Bresenham's circle algorithm
                let r = Math.max(2, randomPoint(width))
                let xc = randomPoint(width)
                let yc = randomPoint(height)

                let drawCircleArc = (xc, yc, x, y) => {
                    addPoint(xc + x, yc + y)
                    addPoint(xc - x, yc + y)
                    addPoint(xc + x, yc - y)
                    addPoint(xc - x, yc - y)
                    addPoint(xc + y, yc + x)
                    addPoint(xc - y, yc + x)
                    addPoint(xc + y, yc - x)
                    addPoint(xc - y, yc - x)
                }

                let x = 0
                let y = r
                let d = 3 - 2 * r
                drawCircleArc(xc, yc, x, y)
                while (y >= x) {
                    x++
                    if (d > 0) {
                        y--
                        d = d + 4 * (x - y) + 10
                    } else {
                        d = d + 4 * x + 6
                    }
                    drawCircleArc(xc, yc, x, y)
                }

            }

            let iterations = width
            for (let i = 0; i < iterations; i++) {
                drawCircle()
            }

            return boardSolution.map(row => row.map(cell => cell || 2))
        }

        this.resetBoard = () => {
            let width = this.state.width
            let height = this.state.height
            let boardState = Array(height).fill(0).map(() => Array(width).fill(0))
            let guessCells = Array(height).fill(0).map(() => Array(width).fill(0))
            let solvedColHints = null
            let solvedRowHints = null
            let history = []
            this.setState({ boardState, solvedColHints, solvedRowHints, guessCells, solved: false, history })
        }

        this.updateCell = (x, y, value) => {
            if (this.state.solved) return

            let boardState = this.state.boardState
            boardState[y][x] = value

            let colHints = this.colHints(this.state.boardSolution)
            let rowHints = this.rowHints(this.state.boardSolution)

            let colSequences = this.colSequences(boardState)
            let rowSequences = this.rowSequences(boardState)

            let solvedColHints = this.solvedHints(colHints, colSequences)
            let solvedRowHints = this.solvedHints(rowHints, rowSequences)

            this.setState({ boardState, colHints, rowHints, solvedColHints, solvedRowHints })

            if (this.testSolution(boardState)) this.solve(boardState)
        }
        
        this.updateGuess = (x, y, value) => {
            let guessCells = this.state.guessCells
            guessCells[y][x] = value
            this.setState({ guessCells })
        }

        this.updateHistory = () => {
            let boardState = this.state.boardState.map(row => row.map(cell => cell))
            let guessCells = this.state.guessCells.map(row => row.map(cell => cell))

            let history = this.state.history.concat([{ boardState, guessCells }])
            if (history.length > 20) history = history.slice(history.length - 20)
            this.setState({ history })
        }

        this.undo = () => {
            if (this.state.history.length < 1) return

            let history = this.state.history.slice()
            let { boardState, guessCells } = history.pop()
            this.setState({ history, boardState, guessCells })
        }

        this.compareHints = (hints, solutionHints) => {
            let ok = true

            hints.forEach((hintGroup, i) => {
                let solutionHintGroup = solutionHints[i]
                if (hintGroup.length !== solutionHintGroup.length) {
                    ok = false
                } else {
                    hintGroup.forEach((hint, j) => {
                        let solutionHint = solutionHintGroup[j]
                        if (hint !== solutionHint) {
                            ok = false
                        }
                    })
                }
            })

            return ok
        }

        this.testSolution = (boardState) => {
            boardState = boardState || this.state.boardState

            let colHints = this.colHints(boardState)
            let rowHints = this.rowHints(boardState)

            let colOk = this.compareHints(colHints, this.state.colHints)
            let rowOk = this.compareHints(rowHints, this.state.rowHints)

            return colOk && rowOk
        }

        this.solve = (boardState) => {
            boardState = boardState.map(row => row.map(cell => cell === 0 ? 2 : cell))
            let guessCells = Array(this.state.width).fill(0).map(() => Array(this.state.height).fill(0))

            this.setState({ boardState, guessCells, solved: true })
        }

        this.parseRow = (row) => {
            let rowString = row.join('')
            let simpleString = rowString.replace(/[02]+/g, '0').replace(/^0+/g, '').replace(/0+$/g, '')
            let runs = simpleString.split('0')
            let runCounts = runs.map(r => r.length)
            runCounts = runCounts.filter(c => c > 0)
            return runCounts
        }

        this.rowHints = (boardState) => {
            return boardState.map(row => this.parseRow(row))
        }

        this.colHints = (boardState) => {
            let width = boardState[0].length
            let hints = []
            for (let x = 0; x < width; x++) {
                let column = boardState.map(row => row[x])
                hints.push(this.parseRow(column))
            }
            return hints
        }

        this.rowSequences = (boardState) => {
            return boardState.map(row => this.getSequences(row))
        }

        this.colSequences = (boardState) => {
            let width = boardState[0].length
            let sequences = []
            for (let x = 0; x < width; x++) {
                let column = boardState.map(row => row[x])
                sequences.push(this.getSequences(column))
            }
            return sequences
        }

        this.getSequences = (row) => {
            let sequenceList = []
            let sequence = []
            let sequenceStarted = false
            let run = ''
            let start, end

            row.map((cell, i) => {
                let isFirstCell = i === 0
                let isLastCell = i === this.state.width - 1

                let startRun = () => {
                    if (!sequenceStarted) start = i
                    end = i
                    sequenceStarted = true
                    run = 0
                }

                let endRun = () => {
                    sequenceStarted = false
                    sequence = []
                    run = 0
                }

                let addToRun = () => {
                    if (sequenceStarted) run++
                }

                let saveRun = () => {
                    if (run) sequence.push(run)
                }

                let saveSequence = () => {
                    if (sequence.length > 0) {
                        sequenceList.push({ value: sequence, start, end })
                    }
                }

                if (isFirstCell && cell > 0) {
                    startRun()
                    if (cell === 1) addToRun()
                } else if (isLastCell && cell > 0) {
                    if (cell === 1) addToRun()
                    end = i
                    saveRun()
                    saveSequence()
                } else if (cell === 0) {
                    saveSequence()
                    endRun()
                } else if (cell === 1) {
                    addToRun()
                } else if (cell === 2) {
                    saveRun()
                    startRun()
                }
            })

            return sequenceList
        }
        
        this.solvedHints = (hints, sequences) => {
            let solvedHints = hints.map((hintsInRow, i) => {
                let solvedHintsInRow = []

                let sequenceList = sequences[i]
                if (hintsInRow.length === 0 || sequenceList.length === 0) return

                sequenceList.forEach(sequence => {
                    let numRuns = sequence.value.length
                    let numHints = hintsInRow.length
                    if (numRuns > numHints) return

                    let hintMatches = []
                    let numMatches = 0

                    let firstHint = 0
                    let lastHint = numHints - numRuns

                    // if sequence starts the row, only compare to the first hints
                    let sequenceStartsRow = sequence.start === 0
                    if (sequenceStartsRow) lastHint = firstHint

                    // if sequence ends the row, only compare to the last hints
                    let sequenceEndsRow = sequence.end === this.state.width - 1
                    if (sequenceEndsRow) firstHint = lastHint

                    for (let j = firstHint; j <= lastHint; j++) {
                        let isMatch = true
                        let tempHintMatches = []
                        sequence.value.forEach((run, k) => {
                            let hint = hintsInRow[j + k]
                            if (run !== hint) isMatch = false
                            else tempHintMatches.push(j + k)
                        })

                        // check if enough room before/after
                        let hintsBefore = hintsInRow.slice(0, j)
                        let hintsAfter = hintsInRow.slice(j + sequence.value.length)
                        let hintsBeforeSum = hintsBefore.reduce((prev, curr) => prev + curr, 0)
                        let hintsAfterSum = hintsAfter.reduce((prev, curr) => prev + curr, 0)
                        let minRoomBefore = hintsBeforeSum + Math.max((hintsBefore.length - 1), 0)
                        let minRoomAfter = hintsAfterSum + Math.max((hintsAfter.length - 1), 0)
                        if (minRoomBefore > sequence.start) isMatch = false
                        if (minRoomAfter > this.state.width - sequence.end - 1) isMatch = false

                        if (isMatch) {
                            numMatches++
                            hintMatches = hintMatches.concat(tempHintMatches)
                        }
                    }

                    // if sequence only matches one set of hints, mark those hints as solved
                    if (numMatches === 1) {
                        solvedHintsInRow = solvedHintsInRow.concat(hintMatches)
                    }
                })

                return solvedHintsInRow
            })

            return solvedHints
        }

        this.resize = (colHints, rowHints) => {
            colHints = this.state.colHints || colHints
            rowHints = this.state.rowHints || rowHints

            let maxColHints = colHints.reduce((prev, curr) => curr.length > prev ? curr.length : prev, 0)
            let maxHoriztonalHints = rowHints.reduce((prev, curr) => curr.length > prev ? curr.length : prev, 0)

            let colTiles = (maxColHints * 0.67) + this.state.height
            let rowTiles = (maxHoriztonalHints * 0.67) + this.state.width

            let tileWidth = Math.floor(window.innerWidth / (rowTiles + 1))
            let tileHeight = Math.floor((window.innerHeight - 130) / (colTiles + 1))
            let tileSize = Math.min(tileWidth, tileHeight)

            let size = Math.min(this.maxSize, Math.max(this.minSize, tileSize))

            let gridWidth = size * this.state.width
            let leftoverSpace = (window.innerWidth - gridWidth) / 2
            let hintTiles = maxHoriztonalHints * 0.67 * size
            let hintsWidth = Math.max(leftoverSpace, hintTiles)
            let boardWidth = hintsWidth + gridWidth

            let controlsWidth = hintTiles + gridWidth
            let marginLeft = Math.max(0, (leftoverSpace - hintTiles))
            if (controlsWidth < 400) marginLeft -= (400 - controlsWidth)
            let marginRight = marginLeft > 0 ? leftoverSpace : (window.innerWidth - boardWidth)
            let boardMargins = { marginLeft: marginLeft + 'px', marginRight: marginRight + 'px' }

            this.setState({ size, boardWidth, boardMargins, hintsWidth })
        }

        this.gradient = () => {
            let color1 = chroma.random()
            let color2 = chroma.random()
            let color3 = chroma.random()
            let angle = Math.floor(Math.random() * 360) + 'deg'
            return `linear-gradient(${angle}, ${color1} 0%, ${color2} 50%, ${color3} 100%)`
        }

        this.changeDrawMode = () => {
            if (this.state.drawMode === 'normal') this.setState({ drawMode: 'guess' })
            else this.setState({ drawMode: 'normal' })
        }
    }

    componentDidMount() {
        window.onresize = this.resize
        this.setupBoard(10, 10)
    }

    render(_, {
        width,
        height,
        size,
        boardState,
        boardSolution,
        boardWidth,
        boardMargins,
        hintsWidth,
        colHints,
        rowHints,
        solvedColHints,
        solvedRowHints,
        guessCells,
        gradient,
        solved,
        drawMode,
        modalOpen,
        history
    }) {
        let updateCell = this.updateCell
        let updateGuess = this.updateGuess
        let updateHistory = this.updateHistory

        let title = h('h1', { style: boardMargins }, 'tomographical')

        let wiki = h('a', { href: 'https://en.wikipedia.org/wiki/Nonogram', target: 'blank' }, 'WHAT')
        let link = h('a', { href: 'https://github.com/zenzoa/tomographical', target: 'blank' }, 'SOURCE')
        let author = h('a', { href: 'https://zenzoa.com', target: 'blank' }, 'SG 2021')
        let footer = h('footer', { style: boardMargins }, [wiki, ' _ ', link, ' _ ', author])

        let drawModeButton = h('button', { type: 'button', onclick: this.changeDrawMode }, drawMode === 'normal' ? 'draw' : 'guess')
        let undoButton = h('button', { type: 'button', disabled: !history.length, onclick: this.undo }, 'undo')
        let divider = h('div', { class: 'divider' })
        let newButton = h('button', { type: 'button', onclick: () => this.setState({ modalOpen: true }) }, 'new')
        let resetButton = h('button', { type: 'button', onclick: this.resetBoard }, 'reset')
        let solveButton = h('button', { type: 'button', onclick: () => this.solve(boardSolution) }, 'solve')
        let controls = h('div', { class: 'button-row', style: boardMargins },
            [drawModeButton, undoButton, divider, newButton, resetButton, solveButton]
        )

        let board = boardState &&
            h(Board, {
                boardWidth,
                width,
                height,
                size,
                hintsWidth,
                boardState,
                updateCell,
                colHints,
                rowHints,
                solvedColHints,
                solvedRowHints,
                guessCells,
                updateGuess,
                gradient,
                drawMode,
                updateHistory
            })

        if (modalOpen) return h(NewGameModal, { onclose: size => size ? this.setupBoard(size, size) : this.setState({ modalOpen: false }) })

        return h('div', { class: (solved && 'solved') + (' draw-mode-' + drawMode) },
            [board, title, controls, footer]
        )
    }
}

class NewGameModal extends Component {
    render({ onclose }) {
        let header = h('div', null, 'new puzzle')
        let buttons = [
            h('button', { type: 'button', onclick: () => onclose(5) }, '5x5'),
            h('button', { type: 'button', onclick: () => onclose(10) }, '10x10'),
            h('button', { type: 'button', onclick: () => onclose(15) }, '15x15'),
            h('button', { type: 'button', onclick: () => onclose(20) }, '20x20'),
            h('button', { type: 'button', onclick: () => onclose(25) }, '25x25'),
            h('button', { type: 'button', onclick: () => onclose(30) }, '30x30')
        ]
        let divider = h('div', { class: 'divider' })
        let cancelButton = h('button', { type: 'button', onclick: () => onclose(0) }, 'cancel')
        return h('div', { class: 'modal' }, [header, buttons, divider, cancelButton])
    }
}

class Board extends Component {
    constructor() {
        super()

        this.state = {
            tempCells: [],
            seqLength: null
        }

        let pointerIsDown = false
        let doubleClickTimeout
        let startCell = null
        let lastCell = null
        let nextValue = 0
        let nextGuess = 0

        this.getGrid = () => {
            let gridEl = document.getElementById('grid')
            return gridEl.getBoundingClientRect()
        }

        this.inGrid = (x, y) => {
            let grid = this.getGrid()
            return x >= grid.left && x < grid.right - 1 && y >= grid.top && y < grid.bottom - 1
        }

        this.getCell = (x, y) => {
            let grid = this.getGrid()
            let dx = x - grid.left
            let dy = y - grid.top
            let cellX = Math.floor(dx / this.props.size)
            let cellY = Math.floor(dy / this.props.size)
            if (cellX < this.props.width && cellY < this.props.height) {
                return {
                    x: cellX,
                    y: cellY,
                    value: this.props.boardState[cellY][cellX],
                    guess: this.props.guessCells[cellY][cellX]
                }
            }
        }

        this.pointerDown = (e) => {
            let realEvent = e.touches ? e.touches[0] : e
            let x = realEvent.clientX
            let y = realEvent.clientY

            if (!this.inGrid(x, y)) return
            e.preventDefault()

            this.startDraw(x, y)

            if (doubleClickTimeout) this.doubleClick()
            else doubleClickTimeout = setTimeout(this.clearDoubleClick, 200)
            lastCell = startCell
        }

        this.clearDoubleClick = () => {
            clearTimeout(doubleClickTimeout)
            doubleClickTimeout = null
        }

        this.doubleClick = () => {
            if (pointerIsDown && lastCell.x === startCell.x && lastCell.y === startCell.y) {
                nextValue = 2
                nextGuess = 2
            }
            this.clearDoubleClick()
        }

        this.pointerMove = (e) => {
            if (!pointerIsDown) return
            e.preventDefault()

            let realEvent = e.touches ? e.touches[0] : e
            let x = realEvent.clientX
            let y = realEvent.clientY
            
            if (this.inGrid(x, y)) {
                let cell = this.getCell(x, y)
                if (!cell) return

                let tempCells = []
                let tempValue = this.props.drawMode === 'normal' ? nextValue : nextGuess
                let updateTempCells = (x, y) => {
                    if (this.props.drawMode === 'normal' || this.props.boardState[y][x] === 0) {
                        tempCells.push([x, y, tempValue])
                    }
                }

                let seqLength = null

                if (cell.x === startCell.x && cell.y === startCell.y) {
                    return
                } else if (cell.x === startCell.x) {
                    let length = this.drawLine(updateTempCells, cell, true)
                    seqLength = { x, y, length }
                } else if (cell.y === startCell.y) {
                    let length = this.drawLine(updateTempCells, cell, false)
                    seqLength = { x, y, length }
                }

                this.setState({ tempCells, seqLength })
                
            } else {
                pointerIsDown = false
                startCell = null
                this.setState({ tempCells: [], seqLength: null })
            }
        }

        this.pointerUp = (e) => {
            if (!pointerIsDown) return
            e.preventDefault()

            let realEvent = e.changedTouches ? e.changedTouches[0] : e
            let x = realEvent.clientX
            let y = realEvent.clientY
            
            this.endDraw(x, y)
        }

        this.startDraw = (x, y) => {
            pointerIsDown = true

            let cell = this.getCell(x, y)
            nextValue = cell.value ? 0 : 1
            nextGuess = cell.guess ? 0 : 1

            startCell = cell
        }

        this.endDraw = (x, y) => {
            pointerIsDown = false
            let cell = this.getCell(x, y)
            if (!cell) return
            
            let drawCell = (x, y) => this.drawCell(x, y)

            if (cell.x === startCell.x && cell.y === startCell.y) {
                this.props.updateHistory()
                this.drawCell(cell.x, cell.y)
            } else if (cell.x === startCell.x) {
                this.props.updateHistory()
                this.drawLine(drawCell, cell, true)
            } else if (cell.y === startCell.y) {
                this.props.updateHistory()
                this.drawLine(drawCell, cell, false)
            }

            startCell = null
            this.setState({ tempCells: [], seqLength: null })
        }

        this.drawCell = (x, y) => {
            if (this.props.drawMode === 'normal') {
                this.props.updateCell(x, y, nextValue)
                this.props.updateGuess(x, y, 0)

            } else if (this.props.boardState[y][x] === 0) {
                this.props.updateCell(x, y, 0)
                this.props.updateGuess(x, y, nextGuess)
            }
        }

        this.drawLine = (callback, endCell, isRow) => {
            let start = isRow ? startCell.y : startCell.x
            let end = isRow ? endCell.y : endCell.x

            let min = Math.min(start, end)
            let max = Math.max(start, end)

            for (let i = min; i <= max; i++) {
                let x = isRow ? startCell.x : i
                let y = isRow ? i : startCell.y
                callback(x, y)
            }

            let length = max - min + 1
            return length
        }
    }

    componentDidMount() {
        document.addEventListener('mousedown', this.pointerDown)
        document.addEventListener('mousemove', this.pointerMove)
        document.addEventListener('mouseup', this.pointerUp)
        
        document.addEventListener('touchstart', this.pointerDown, { passive: false })
        document.addEventListener('touchmove', this.pointerMove, { passive: false })
        document.addEventListener('touchend', this.pointerUp, { passive: false })
        document.addEventListener('touchcancel', this.pointerUp, { passive: false })
    }

    componentWillUnmount() {
        document.removeEventListener('mousedown', this.pointerDown)
        document.removeEventListener('mousemove', this.pointerMove)
        document.removeEventListener('mouseup', this.pointerUp)

        document.removeEventListener('touchstart', this.pointerDown)
        document.removeEventListener('touchmove', this.pointerMove)
        document.removeEventListener('touchend', this.pointerUp)
        document.removeEventListener('touchcancel', this.pointerUp)
    }

    component(nextProps) {
        if (nextProps.gradient !== this.props.gradient) {
            let guessCells = Array(nextProps.width).fill(0).map(() => Array(nextProps.height).fill(0))
            this.setState({ guessCells })
        }
    }

    render({ boardWidth, width, height, size, hintsWidth, boardState, colHints, rowHints, solvedColHints, solvedRowHints, guessCells, gradient }, { tempCells, seqLength }) {
        let cell = (x, y, isTemp, tempValue) => {
            let value = boardState[y][x]
            let guessValue = guessCells[y][x]

            let classes = ['cell', 'cell-' + value]
            if (isTemp) classes = classes.concat(['cell-temp', 'cell-temp-' + tempValue])
            if (guessValue) classes = classes.concat(['cell-guess', 'cell-guess-' + guessValue])

            return h('div', { class: classes.join(' ') })
        }

        let seqDiv = null
        if (seqLength) {
            let seqSize = 12
            let seqStyle = {
                width: seqSize * 2 + 'px',
                height: seqSize * 2 + 'px',
                left: seqLength.x - seqSize + 'px',
                top: seqLength.y - (seqSize * 3) + 'px',
                fontSize: seqSize + 'px'
            }
            seqDiv = h('div', { class: 'seq-length', style: seqStyle }, seqLength.length)
        }

        return h('div', { class: 'board-container', style: { width: boardWidth } }, [
            h('table', { class: 'board' }, [
                h('tr', null, [
                    h('td'),
                    h('td', null, h(Hints, { size, isCol: true, hints: colHints, solvedHints: solvedColHints, boardState }))
                ]),
                h('tr', null, [
                    h('td', null, h(Hints, { size, hintsWidth, isCol: false, hints: rowHints, solvedHints: solvedRowHints, boardState })),
                    h('td', null, h(Grid, { width, height, size, cell, gradient, tempCells }))
                ])
            ]),
            seqDiv
        ])
    }
}

class Hints extends Component {
    render({ size, hintsWidth, isCol, hints, solvedHints }) {
        let contents
        let innerSize = Math.floor(Math.max(12, size * 0.67))
        let fontSize = Math.floor(Math.min(16, Math.max(10, innerSize - 4)))

        if (isCol) {
            contents = h('tr', null, hints.map((hintGroup, i) => {
                let solvedHintsInRow = solvedHints && solvedHints[i]
                return h('td', { style: { width: size + 'px' } }, hintGroup.map((hint, j) => {
                    let hintCompleted = solvedHintsInRow && solvedHintsInRow.includes(j)
                    return h('div', {
                        class: 'hint ' + (hintCompleted ? 'hint-completed' : ''),
                        style: { height: innerSize + 'px', fontSize: fontSize + 'px' }
                    }, hint)
                }))
            }))
        } else {
            contents = hints.map((hintGroup, i) => {
                let solvedHintsInRow = solvedHints && solvedHints[i]
                return h('tr', null, h('td', { style: { height: size + 'px' } }, hintGroup.map((hint, j) => {
                    let hintCompleted = solvedHintsInRow && solvedHintsInRow.includes(j)
                    return h('div', {
                        class: 'hint ' + (hintCompleted ? 'hint-completed' : ''),
                        style: { width: innerSize + 'px', fontSize: fontSize + 'px' }
                    }, hint)
                })))
            })
        }

        return h('div', { class: 'hints-container' },
            h('table', {
                class: 'hints ' + (isCol ? 'hints-col' : 'hints-row'),
                style: hintsWidth ? { width: hintsWidth } : null
            }, contents)
        )
    }
}

class Grid extends Component {
    render({ width, height, size, cell, gradient, tempCells }) {
        let style = {
            width: size + 'px',
            height: size + 'px'
        }

        let rows = Array(height).fill(0).map((_, y) => {
            return h('tr', null, Array(width).fill(0).map((_, x) => {
                let isTemp, tempValue
                tempCells && tempCells.forEach(tempCell => {
                    if (tempCell[0] === x && tempCell[1] === y) {
                        isTemp = true
                        tempValue = tempCell[2]
                    }
                })
                return h('td', { style }, cell && cell(x, y, isTemp, tempValue))
            }))
        })

        return h('div', { class: 'grid-container', id: 'grid', style: { background: gradient } }, [
            h('table', { class: 'grid' }, rows)
        ])
    }
}