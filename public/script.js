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

        socket.emit('move', {
            from: selectedPiece,
            to: { r, c },
            color: myColor
        });

        selectedPiece = null;
        renderBoard();
    } else {
        if (clickedPiece && clickedPiece.color === myColor) {
            selectedPiece = { r, c };
            renderBoard();
        }
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
