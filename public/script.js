const socket = io();
const boardElement = document.getElementById('chessboard');
const statusElement = document.getElementById('status');
const endBtn = document.getElementById('end-btn');

const BOARD_SIZE = 14;
const PLAYERS = ['red', 'blue', 'yellow', 'green'];
let boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

let myColor = null;
let currentTurnIndex = 0;
let selectedPiece = null;

// Modal Logic
const nameModal = new bootstrap.Modal(document.getElementById('nameModal'));
const joinBtn = document.getElementById('joinBtn');
const nameInput = document.getElementById('playerNameInput');

// Show modal on load
window.onload = () => {
    nameModal.show();
};

joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        socket.emit('join', name);
        nameModal.hide();
    }
});

endBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to end the game?")) {
        socket.emit('endGame');
    }
});


// Piece definitions using Text Style (VS15) to allow coloring
const PIECES = {
    p: '♟\uFE0E', r: '♜\uFE0E', n: '♞\uFE0E', b: '♝\uFE0E', q: '♛\uFE0E', k: '♚\uFE0E'
};

// 0 = invalid, 1 = valid
function isValidSquare(row, col) {
    if ((row < 3 || row > 10) && (col < 3 || col > 10)) {
        return false;
    }
    return true;
}

function initGame() {
    // Clear board
    boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    // Setup function
    const setupPlayer = (color, rowFunc, colFunc, pieces) => {
        pieces.forEach((p, i) => {
            const r = rowFunc(i);
            const c = colFunc(i);
            boardState[r][c] = { type: p, color: color };
        });
    };

    const units = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const pawns = Array(8).fill('p');

    // Red (Bottom)
    setupPlayer('red', () => 13, (i) => i + 3, units);
    setupPlayer('red', () => 12, (i) => i + 3, pawns);

    // Yellow (Top)
    setupPlayer('yellow', () => 0, (i) => i + 3, units);
    setupPlayer('yellow', () => 1, (i) => i + 3, pawns);

    // Blue (Left)
    setupPlayer('blue', (i) => i + 3, () => 0, units);
    setupPlayer('blue', (i) => i + 3, () => 1, pawns);

    // Green (Right)
    setupPlayer('green', (i) => i + 3, () => 13, units);
    setupPlayer('green', (i) => i + 3, () => 12, pawns);

    renderBoard();
}

function updateStatus() {
    let statusText = `Turn: ${PLAYERS[currentTurnIndex].toUpperCase()}`;
    if (myColor) {
        statusText += ` | You are: ${myColor.toUpperCase()}`;
        endBtn.style.display = 'block'; // Allow quit
    } else {
        statusText += ` | Spectating/Full`;
        endBtn.style.display = 'none';
    }
    statusElement.innerText = statusText;
    statusElement.className = '';
    statusElement.classList.add(`player-${PLAYERS[currentTurnIndex]}`);
}

function rotateBoard(color) {
    boardElement.classList.remove('rotate-0', 'rotate-90', 'rotate-180', 'rotate-270');

    // We want 'color' to be at the bottom.
    // Red is naturally at bottom (row 12,13).
    // if Red -> rotate 0.
    // Blue is Left (col 0,1). To put at bottom -> Rotate 90 deg C? 
    //   Left (9 o'clock) -> Bottom (6 o'clock) = -90 or 270 deg.
    // Yellow is Top (row 0,1). To put at bottom -> Rotate 180 deg.
    // Green is Right (col 12,13). To put at bottom -> Rotate 90 deg.

    switch (color) {
        case 'red':
            boardElement.classList.add('rotate-0');
            break;
        case 'blue':
            boardElement.classList.add('rotate-90'); // 90? Left to Bottom is counter-clockwise 90 (-90 or 270) NO. 
            // If I am looking at screen:
            // Top: Yellow. Bottom: Red. Left: Blue. Right: Green.
            // If I am Blue, I am currently on Left. I want to be Bottom.
            // Image needs to rotate Clockwise 90 degrees?
            // Left goes to Top. Top goes Right. Right goes Bottom. Bottom goes Left. 
            // Wait. 
            // If I rotate 90 deg CW: 
            // 12 -> 3. (Top -> Right). Yellow ends up Right.
            // 9 -> 12. (Left -> Top). Blue ends up Top. 
            // 6 -> 9. (Bottom -> Left). Red ends up Left.
            // 3 -> 6. (Right -> Bottom). Green ends up Bottom.

            // So +90 makes Green bottom.
            // So Blue needs -90 (or 270).

            // Let's re-verify Standard CSS rotation direction. positive = CW.
            // To bring Left (Blue) to Bottom: Rotate -90 (CCW).

            boardElement.classList.add('rotate-270'); // Equivalent to -90
            break;
        case 'yellow':
            boardElement.classList.add('rotate-180');
            break;
        case 'green':
            boardElement.classList.add('rotate-90'); // Right to Bottom = CW 90.
            break;
        default:
            boardElement.classList.add('rotate-0');
    }
}


function handleCellClick(r, c) {
    if (!isValidSquare(r, c)) return;
    if (!myColor) return;
    if (PLAYERS[currentTurnIndex] !== myColor) return;

    const clickedPiece = boardState[r][c];

    if (selectedPiece) {
        if (selectedPiece.r === r && selectedPiece.c === c) {
            selectedPiece = null;
            renderBoard();
            return;
        }

        if (clickedPiece && clickedPiece.color === myColor) {
            selectedPiece = { r, c };
            renderBoard();
            return;
        }

        if (validateMove(selectedPiece, { r, c }, boardState)) {
            socket.emit('move', {
                from: selectedPiece,
                to: { r, c },
                color: myColor
            });

            selectedPiece = null;
            renderBoard();
        } else {
            alert("Invalid Move!");
            selectedPiece = null;
            renderBoard();
        }
    } else {
        if (clickedPiece && clickedPiece.color === myColor) {
            selectedPiece = { r, c };
            renderBoard();
        }
    }
}

// --- Validation Logic ---

function validateMove(from, to, board) {
    const piece = board[from.r][from.c];
    if (!piece) return false;

    const rDiff = to.r - from.r;
    const cDiff = to.c - from.c;
    const rDist = Math.abs(rDiff);
    const cDist = Math.abs(cDiff);

    // Target check: cannot capture own piece
    const target = board[to.r][to.c];
    if (target && target.color === piece.color) return false;

    // Helper: is path clear? (Exclusive of start and end)
    const isPathClear = () => {
        const rStep = rDiff === 0 ? 0 : rDiff / rDist;
        const cStep = cDiff === 0 ? 0 : cDiff / cDist;

        let currR = from.r + rStep;
        let currC = from.c + cStep;

        while (currR !== to.r || currC !== to.c) {
            if (board[currR][currC]) return false; // Obstruction found
            currR += rStep;
            currC += cStep;
        }
        return true;
    };

    switch (piece.type) {
        case 'n': // Knight: L-shape
            return (rDist === 2 && cDist === 1) || (rDist === 1 && cDist === 2);

        case 'r': // Rook: Straight
            if (rDiff !== 0 && cDiff !== 0) return false;
            return isPathClear();

        case 'b': // Bishop: Diagonal
            if (rDist !== cDist) return false;
            return isPathClear();

        case 'q': // Queen: Rook + Bishop
            if ((rDiff === 0 || cDiff === 0) || (rDist === cDist)) {
                return isPathClear();
            }
            return false;

        case 'k': // King: 1 step
            return rDist <= 1 && cDist <= 1;

        case 'p': // Pawn
            // Direction depends on color
            // Red (Bottom) -> Forward is row-1
            // Yellow (Top) -> Forward is row+1
            // Blue (Left) -> Forward is col+1
            // Green (Right) -> Forward is col-1

            let fwdR = 0, fwdC = 0;
            let startRow = -1, startCol = -1;

            if (piece.color === 'red') { fwdR = -1; startRow = 12; }
            else if (piece.color === 'yellow') { fwdR = 1; startRow = 1; }
            else if (piece.color === 'blue') { fwdC = 1; startCol = 1; } // Check start cols! Script says setupPlayer(blue, i+3, 0) and pawns at (i+3, 1)
            else if (piece.color === 'green') { fwdC = -1; startCol = 12; }

            // General Pawn Logic

            // 1. Regular Move (1 step forward, no capture)
            if (rDiff === fwdR && cDiff === fwdC && !target) {
                return true;
            }

            // 2. Double Move (2 steps forward, no capture, must be at start)
            if (rDiff === fwdR * 2 && cDiff === fwdC * 2 && !target) {
                // Check if start position
                let isAtStart = false;
                if (piece.color === 'red' || piece.color === 'yellow') isAtStart = from.r === startRow;
                else isAtStart = from.c === startCol;

                if (isAtStart) {
                    // Check path clear for the single step in between
                    const rMid = from.r + fwdR;
                    const cMid = from.c + fwdC;
                    if (!board[rMid][cMid]) return true;
                }
            }

            // 3. Capture (1 step diagonal)
            // Diagonals must have rDiff = +/- 1 AND cDiff = +/- 1?
            // Actually pawn capture is forward-diagonal.
            // So one component must be Forward, other must be +/- 1.

            // Check Forward component matches fwdR/fwdC
            const validFwd = (fwdR !== 0 && rDiff === fwdR) || (fwdC !== 0 && cDiff === fwdC);
            // Check Lateral component is 1
            const lateralDist = fwdR !== 0 ? Math.abs(cDiff) : Math.abs(rDiff);

            if (validFwd && lateralDist === 1 && target) {
                return true;
            }

            return false;

        default:
            return false;
    }
}


socket.on('init', (data) => {
    myColor = data.color;
    currentTurnIndex = data.turnIndex;
    updateStatus();
    rotateBoard(myColor);
});

socket.on('spectator', (data) => {
    myColor = null;
    currentTurnIndex = data.turnIndex;
    updateStatus();
});

socket.on('move', (msg) => {
    const { from, to, color } = msg;
    const piece = boardState[from.r][from.c];
    if (piece) {
        boardState[to.r][to.c] = piece;
        boardState[from.r][from.c] = null;
        renderBoard();
    }
});

socket.on('turnChange', (newIndex) => {
    currentTurnIndex = newIndex;
    updateStatus();
});

socket.on('gameEnded', () => {
    alert("Game Ended!");
    initGame();
    currentTurnIndex = 0;
    updateStatus();
});

socket.on('resetBoard', () => {
    initGame();
    updateStatus();
});


function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');

            if (isValidSquare(r, c)) {
                const isWhite = (r + c) % 2 === 0;
                cell.classList.add(isWhite ? 'white' : 'black');
                cell.dataset.row = r;
                cell.dataset.col = c;

                // Highlight selection
                if (selectedPiece && selectedPiece.r === r && selectedPiece.c === c) {
                    cell.style.border = "3px solid white"; // Changed to white/custom for visibility
                }

                cell.addEventListener('click', () => handleCellClick(r, c));

                const piece = boardState[r][c];
                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.classList.add('piece');
                    pieceEl.classList.add(piece.color);
                    pieceEl.innerText = PIECES[piece.type];
                    cell.appendChild(pieceEl);
                }
            } else {
                cell.classList.add('invalid');
            }

            boardElement.appendChild(cell);
        }
    }
}

initGame();

// Player List Logic
const playerListElement = document.getElementById('player-list');

function renderPlayerList(playersData) {
    playerListElement.innerHTML = '';

    // Sort logic or fixed order? Let's just iterate colors
    PLAYERS.forEach(color => {
        const player = playersData[color];
        if (player) {
            const item = document.createElement('div');
            item.className = 'player-item';

            const dot = document.createElement('span');
            dot.className = 'player-dot';
            dot.style.backgroundColor = getHexColor(color);

            const nameSpan = document.createElement('span');
            nameSpan.innerText = `${player.name} (${color.toUpperCase()})`;
            nameSpan.style.color = 'white';

            item.appendChild(dot);
            item.appendChild(nameSpan);
            playerListElement.appendChild(item);
        }
    });
}

function getHexColor(colorName) {
    switch (colorName) {
        case 'red': return '#ff3333';
        case 'blue': return '#3333ff';
        case 'yellow': return '#ffff00';
        case 'green': return '#00e600';
        default: return 'white';
    }
}

socket.on('playerUpdate', (playersData) => {
    renderPlayerList(playersData);
});

// Update init to also render list
const originalInit = socket.listeners('init')[0];
socket.removeAllListeners('init');
socket.on('init', (data) => {
    myColor = data.color;
    currentTurnIndex = data.turnIndex;
    updateStatus();
    rotateBoard(myColor);
    renderPlayerList(data.players);
});

// Update spectator to also render list
const originalSpectator = socket.listeners('spectator')[0];
socket.removeAllListeners('spectator');
socket.on('spectator', (data) => {
    myColor = null;
    currentTurnIndex = data.turnIndex;
    updateStatus();
    renderPlayerList(data.players);
});
